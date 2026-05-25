import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories, resolutionRuns, results, teams } from '@/db/schema'
import type { TournamentSnapshot } from '@/integrations/football'
import { getFootballProvider } from '@/integrations/football'

type ResolutionOutcome =
  | { kind: 'team'; teamFifaCode: string }
  | { kind: 'player'; playerExternalId: string }
  | { kind: 'team_set'; teamFifaCodes: string[] }
  | { kind: 'skip'; reason: string }

function resolveCategory(strategy: string, snapshot: TournamentSnapshot): ResolutionOutcome {
  switch (strategy) {
    case 'final_winner':
      return snapshot.champion
        ? { kind: 'team', teamFifaCode: snapshot.champion.fifaCode }
        : { kind: 'skip', reason: 'champion unknown' }
    case 'final_loser':
      return snapshot.runnerUp
        ? { kind: 'team', teamFifaCode: snapshot.runnerUp.fifaCode }
        : { kind: 'skip', reason: 'runner-up unknown' }
    case 'third_place':
      return snapshot.thirdPlace
        ? { kind: 'team', teamFifaCode: snapshot.thirdPlace.fifaCode }
        : { kind: 'skip', reason: 'third place unknown' }
    case 'finalists':
      return snapshot.finalists
        ? {
            kind: 'team_set',
            teamFifaCodes: snapshot.finalists.map((t) => t.fifaCode),
          }
        : { kind: 'skip', reason: 'finalists unknown' }
    case 'top_scorer_player':
      return snapshot.topScorer
        ? {
            kind: 'player',
            playerExternalId: snapshot.topScorer.player.externalId,
          }
        : { kind: 'skip', reason: 'top scorer unknown' }
    case 'top_scoring_team':
      return snapshot.topScoringTeam
        ? { kind: 'team', teamFifaCode: snapshot.topScoringTeam.team.fifaCode }
        : { kind: 'skip', reason: 'top scoring team unknown' }
    case 'most_conceded_team':
      return snapshot.mostConcededTeam
        ? { kind: 'team', teamFifaCode: snapshot.mostConcededTeam.team.fifaCode }
        : { kind: 'skip', reason: 'most conceded team unknown' }
    case 'fifa_golden_ball':
      return snapshot.goldenBall
        ? { kind: 'player', playerExternalId: snapshot.goldenBall.externalId }
        : { kind: 'skip', reason: 'golden ball not awarded yet' }
    case 'fifa_golden_glove':
      return snapshot.goldenGlove
        ? { kind: 'player', playerExternalId: snapshot.goldenGlove.externalId }
        : { kind: 'skip', reason: 'golden glove not awarded yet' }
    case 'fifa_young_player':
      return snapshot.bestYoungPlayer
        ? {
            kind: 'player',
            playerExternalId: snapshot.bestYoungPlayer.externalId,
          }
        : { kind: 'skip', reason: 'young player not awarded yet' }
    case 'revelation':
    case 'disappointment':
    case 'top_n_teams':
    case 'manual':
      return { kind: 'skip', reason: `strategy "${strategy}" not implemented yet` }
    default:
      return { kind: 'skip', reason: `unknown strategy "${strategy}"` }
  }
}

export async function runResolution() {
  const provider = getFootballProvider()
  const [run] = await db.insert(resolutionRuns).values({ status: 'running' }).returning()

  try {
    const snapshot = await provider.fetchTournamentSnapshot()
    const cats = await db.select().from(categories)
    const summary: Record<string, string> = {}

    for (const cat of cats) {
      const outcome = resolveCategory(cat.resolutionStrategy, snapshot)
      if (outcome.kind === 'skip') {
        summary[cat.key] = `skip: ${outcome.reason}`
        continue
      }
      if (outcome.kind === 'team') {
        const team = await db.query.teams.findFirst({
          where: eq(teams.fifaCode, outcome.teamFifaCode),
        })
        if (!team) {
          summary[cat.key] = `skip: team ${outcome.teamFifaCode} missing in db`
          continue
        }
        await db
          .insert(results)
          .values({
            categoryId: cat.id,
            teamId: team.id,
            source: provider.id,
          })
          .onConflictDoUpdate({
            target: results.categoryId,
            set: { teamId: team.id, source: provider.id, resolvedAt: new Date() },
          })
        summary[cat.key] = `team:${team.fifaCode}`
        continue
      }
      summary[cat.key] = `pending integration for ${outcome.kind}`
    }

    await db
      .update(resolutionRuns)
      .set({
        finishedAt: new Date(),
        status: 'completed',
        details: { provider: provider.id, summary },
      })
      .where(eq(resolutionRuns.id, run.id))

    return { runId: run.id, summary }
  } catch (error) {
    await db
      .update(resolutionRuns)
      .set({
        finishedAt: new Date(),
        status: 'failed',
        details: { error: error instanceof Error ? error.message : String(error) },
      })
      .where(eq(resolutionRuns.id, run.id))
    throw error
  }
}
