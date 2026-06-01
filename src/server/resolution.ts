import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  categories,
  groupCategories,
  groups,
  predictions,
  resolutionRuns,
  results,
  teams,
} from '@/db/schema'
import { getFootballProvider } from '@/integrations/football'
import { teamMatchKey } from '@/integrations/football/normalize'
import type { TournamentSnapshot } from '@/integrations/football/types'
import { sendPushToUsers } from '@/server/push'

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
    case 'top_assists_player':
      return { kind: 'player', reason: 'top assists auto-resolution pending' }
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
    const newlyResolvedCategoryIds: string[] = []

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
        newlyResolvedCategoryIds.push(cat.id)
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
        newlyResolvedCategoryIds.push(cat.id)
      }
    }

    // Notify users who got the resolved categories right. Best-effort —
    // failures are logged but don't block the resolution from finishing.
    try {
      await notifyWinners(newlyResolvedCategoryIds)
    } catch (e) {
      console.error('notifyWinners failed', (e as Error).message)
    }

    await db
      .update(resolutionRuns)
      .set({
        finishedAt: new Date(),
        status: 'completed',
        details: { provider: provider.id, summary },
      })
      .where(eq(resolutionRuns.id, run.id))

    return { runId: run.id, summary, notifiedCategories: newlyResolvedCategoryIds.length }
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

/**
 * After categories get resolved, find users who picked them correctly across
 * any group and ping them with a push notification. Best-effort — only sends
 * to subscribers that exist (no-op if no one opted in yet).
 */
async function notifyWinners(resolvedCategoryIds: string[]) {
  if (resolvedCategoryIds.length === 0) return

  const [resolvedResults, catRows] = await Promise.all([
    db
      .select({
        categoryId: results.categoryId,
        teamId: results.teamId,
        teamSet: results.teamSet,
        playerText: results.playerText,
      })
      .from(results)
      .where(inArray(results.categoryId, resolvedCategoryIds)),
    db
      .select({
        id: categories.id,
        key: categories.key,
        name: categories.name,
        valueKind: categories.valueKind,
      })
      .from(categories)
      .where(inArray(categories.id, resolvedCategoryIds)),
  ])

  const catById = new Map(catRows.map((c) => [c.id, c]))
  const resultByCat = new Map(resolvedResults.map((r) => [r.categoryId, r]))

  // For each resolved category, pull all matching predictions across every
  // group, plus the group-specific points for the win.
  const allPredictions = await db
    .select({
      userId: predictions.userId,
      groupId: predictions.groupId,
      groupSlug: groups.slug,
      groupName: groups.name,
      categoryId: predictions.categoryId,
      categoryPoints: groupCategories.points,
      teamId: predictions.teamId,
      teamSet: predictions.teamSet,
      playerText: predictions.playerText,
    })
    .from(predictions)
    .innerJoin(groups, eq(groups.id, predictions.groupId))
    .innerJoin(groupCategories, eq(groupCategories.categoryId, predictions.categoryId))
    .where(inArray(predictions.categoryId, resolvedCategoryIds))

  // userId → { points, names: string[] }
  const wins = new Map<
    string,
    { totalPoints: number; categoryNames: string[]; groupSlug: string }
  >()

  for (const p of allPredictions) {
    const cat = catById.get(p.categoryId)
    const result = resultByCat.get(p.categoryId)
    if (!cat || !result) continue

    let earned = 0
    if (cat.valueKind === 'team' && p.teamId && result.teamId && p.teamId === result.teamId) {
      earned = p.categoryPoints
    } else if (
      cat.valueKind === 'player' &&
      p.playerText &&
      result.playerText &&
      p.playerText.trim().toLowerCase() === result.playerText.trim().toLowerCase()
    ) {
      earned = p.categoryPoints
    } else if (cat.valueKind === 'team_set') {
      const pickSet = new Set((p.teamSet as string[] | null) ?? [])
      const resultSet = new Set((result.teamSet as string[] | null) ?? [])
      let hits = 0
      for (const id of pickSet) if (resultSet.has(id)) hits++
      if (hits > 0) earned = hits * p.categoryPoints
    }
    if (earned === 0) continue

    const key = p.userId
    const prev = wins.get(key)
    if (prev) {
      prev.totalPoints += earned
      prev.categoryNames.push(cat.name)
    } else {
      wins.set(key, {
        totalPoints: earned,
        categoryNames: [cat.name],
        groupSlug: p.groupSlug,
      })
    }
  }

  for (const [userId, { totalPoints, categoryNames, groupSlug }] of wins) {
    const body =
      categoryNames.length === 1
        ? `Acertaste ${categoryNames[0]}`
        : `Acertaste ${categoryNames.length} categorías`
    await sendPushToUsers([userId], {
      title: `🏆 ¡+${totalPoints} pts!`,
      body,
      url: `/groups/${groupSlug}`,
      tag: `result-${userId}-${Date.now()}`,
    })
  }
}
