import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories, resolutionRuns, results, teams } from '@/db/schema'
import { getFootballProvider } from '@/integrations/football'
import { teamMatchKey } from '@/integrations/football/normalize'
import type { TournamentSnapshot } from '@/integrations/football/types'

type Outcome =
  | { kind: 'team'; teamName: string }
  | { kind: 'player'; reason: string }
  | { kind: 'team_set'; teamNames: string[] }
  | { kind: 'skip'; reason: string }

function planCategory(strategy: string, snapshot: TournamentSnapshot): Outcome {
  switch (strategy) {
    case 'final_winner':
      return snapshot.champion
        ? { kind: 'team', teamName: snapshot.champion.name }
        : { kind: 'skip', reason: 'champion unknown' }
    case 'final_loser':
      return snapshot.runnerUp
        ? { kind: 'team', teamName: snapshot.runnerUp.name }
        : { kind: 'skip', reason: 'runner-up unknown' }
    case 'third_place':
      return snapshot.thirdPlace
        ? { kind: 'team', teamName: snapshot.thirdPlace.name }
        : { kind: 'skip', reason: 'third place unknown' }
    case 'finalists':
      return snapshot.finalists
        ? { kind: 'team_set', teamNames: snapshot.finalists.map((t) => t.name) }
        : { kind: 'skip', reason: 'finalists unknown' }
    case 'top_scoring_team':
      return snapshot.topScoringTeam
        ? { kind: 'team', teamName: snapshot.topScoringTeam.team.name }
        : { kind: 'skip', reason: 'top scoring team unknown' }
    case 'most_conceded_team':
      return snapshot.mostConcededTeam
        ? { kind: 'team', teamName: snapshot.mostConcededTeam.team.name }
        : { kind: 'skip', reason: 'most conceded team unknown' }
    case 'top_scorer_player':
      return { kind: 'player', reason: 'top scorer auto-resolution pending' }
    case 'fifa_golden_ball':
    case 'fifa_golden_glove':
    case 'fifa_young_player':
      return { kind: 'player', reason: `${strategy} requires manual override` }
    case 'revelation':
    case 'disappointment':
    case 'top_n_teams':
    case 'manual':
      return { kind: 'skip', reason: `strategy "${strategy}" not implemented yet` }
    default:
      return { kind: 'skip', reason: `unknown strategy "${strategy}"` }
  }
}

async function loadTeamIndex() {
  const rows = await db.select().from(teams)
  const byKey = new Map<string, (typeof rows)[number]>()
  for (const t of rows) byKey.set(teamMatchKey(t.name), t)
  return byKey
}

export async function runResolution() {
  const provider = getFootballProvider()
  const [run] = await db.insert(resolutionRuns).values({ status: 'running' }).returning()

  try {
    const [snapshot, teamIndex, cats] = await Promise.all([
      provider.fetchTournamentSnapshot(),
      loadTeamIndex(),
      db.select().from(categories),
    ])

    const summary: Record<string, string> = {}

    for (const cat of cats) {
      const outcome = planCategory(cat.resolutionStrategy, snapshot)

      if (outcome.kind === 'skip' || outcome.kind === 'player') {
        summary[cat.key] = `skip: ${outcome.reason}`
        continue
      }

      if (outcome.kind === 'team') {
        const team = teamIndex.get(teamMatchKey(outcome.teamName))
        if (!team) {
          summary[cat.key] = `skip: team "${outcome.teamName}" not in db`
          continue
        }
        await db
          .insert(results)
          .values({ categoryId: cat.id, teamId: team.id, source: provider.id })
          .onConflictDoUpdate({
            target: results.categoryId,
            set: {
              teamId: team.id,
              teamSet: null,
              playerId: null,
              source: provider.id,
              resolvedAt: new Date(),
            },
          })
        summary[cat.key] = `team:${team.fifaCode ?? team.name}`
        continue
      }

      if (outcome.kind === 'team_set') {
        const matched: string[] = []
        const missing: string[] = []
        for (const name of outcome.teamNames) {
          const t = teamIndex.get(teamMatchKey(name))
          if (t) matched.push(t.id)
          else missing.push(name)
        }
        if (missing.length > 0) {
          summary[cat.key] = `skip: teams missing in db: ${missing.join(', ')}`
          continue
        }
        await db
          .insert(results)
          .values({
            categoryId: cat.id,
            teamSet: matched,
            source: provider.id,
          })
          .onConflictDoUpdate({
            target: results.categoryId,
            set: {
              teamSet: matched,
              teamId: null,
              playerId: null,
              source: provider.id,
              resolvedAt: new Date(),
            },
          })
        summary[cat.key] = `team_set:${matched.length}`
      }
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
