import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  categories,
  groupCategories,
  groups,
  predictions,
  profiles,
  resolutionRuns,
  results,
  teams,
} from '@/db/schema'
import { updateTeamStandings } from '@/features/tournament/standings'
import { getFootballProvider } from '@/integrations/football'
import { teamMatchKey } from '@/integrations/football/normalize'
import type { TournamentSnapshot } from '@/integrations/football/types'
import { sendNotificationByType } from '@/server/notifications/send'

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

    // Snapshot who's currently in #1 per group BEFORE writing any results.
    // After the run completes we diff against the post-snapshot to detect
    // dethroned leaders. Has to happen before the INSERT loop because the
    // v_user_scores view reflects results as soon as they're written.
    const preTops = await getTopUserIdsByGroup()

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

    // Notify users who got the resolved categories right + anyone who fell
    // out of #1 because of these results. Best-effort — failures are logged
    // but don't block the resolution from finishing. Pre-snapshot was taken
    // before the result INSERTs above so the dethroned diff is meaningful.
    try {
      await notifyWinners(newlyResolvedCategoryIds)
    } catch (e) {
      console.error('notifyWinners failed', (e as Error).message)
    }
    try {
      const postTops = await getTopUserIdsByGroup()
      await notifyDethroned(preTops, postTops, run.id)
      await notifyClimbedToTop(preTops, postTops, run.id)
    } catch (e) {
      console.error('rank diff notifications failed', (e as Error).message)
    }

    // Tournament standings: fetch matches from the provider and update the
    // teams table so /torneo/selecciones reflects current positions. Mock
    // provider returns []; the function is idempotent on empty input.
    try {
      const rawMatches = await provider.fetchMatches()
      await updateTeamStandings(rawMatches)
    } catch (e) {
      console.error('updateTeamStandings failed', (e as Error).message)
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
    await sendNotificationByType('result_winner', [userId], {
      title: `🏆 ¡+${totalPoints} pts!`,
      body,
      url: `/groups/${groupSlug}`,
      tag: `result-${userId}-${Date.now()}`,
    })
  }
}

// Map<groupId, Set<userId of #1>> using competition ranking against the
// v_user_scores view. Filters out groups where everyone is tied at 0 points
// (pre-tournament noise) so the first real resolution doesn't trigger a
// "dethroned" push for every member.
async function getTopUserIdsByGroup(): Promise<Map<string, Set<string>>> {
  const rows = await db.execute<{ group_id: string; user_id: string }>(sql`
    SELECT group_id, user_id
    FROM (
      SELECT group_id, user_id,
             RANK() OVER (PARTITION BY group_id ORDER BY total_points DESC) AS rk
      FROM v_user_scores
      WHERE total_points > 0
    ) ranked
    WHERE rk = 1
  `)
  const out = new Map<string, Set<string>>()
  for (const r of rows) {
    const set = out.get(r.group_id) ?? new Set<string>()
    set.add(r.user_id)
    out.set(r.group_id, set)
  }
  return out
}

async function notifyDethroned(
  pre: Map<string, Set<string>>,
  post: Map<string, Set<string>>,
  resolutionRunId: string,
): Promise<void> {
  // Collect (groupId, userId) pairs for displaced leaders so we can batch the
  // group/profile lookups once.
  type Displaced = { groupId: string; userId: string }
  const displaced: Displaced[] = []
  const newTopsByGroup = new Map<string, string[]>()
  for (const [groupId, preSet] of pre) {
    if (preSet.size === 0) continue
    const postSet = post.get(groupId) ?? new Set<string>()
    for (const uid of preSet) {
      if (!postSet.has(uid)) displaced.push({ groupId, userId: uid })
    }
    if (postSet.size > 0) newTopsByGroup.set(groupId, Array.from(postSet))
  }
  if (displaced.length === 0) return

  const affectedGroupIds = [...new Set(displaced.map((d) => d.groupId))]
  const allNewTopIds = [
    ...new Set(affectedGroupIds.flatMap((gid) => newTopsByGroup.get(gid) ?? [])),
  ]

  const [groupRows, topProfileRows] = await Promise.all([
    db
      .select({ id: groups.id, slug: groups.slug, name: groups.name })
      .from(groups)
      .where(inArray(groups.id, affectedGroupIds)),
    allNewTopIds.length > 0
      ? db
          .select({ id: profiles.id, displayName: profiles.displayName })
          .from(profiles)
          .where(inArray(profiles.id, allNewTopIds))
      : Promise.resolve([] as { id: string; displayName: string }[]),
  ])

  const groupById = new Map(groupRows.map((g) => [g.id, g]))
  const nameById = new Map(topProfileRows.map((p) => [p.id, p.displayName]))

  for (const d of displaced) {
    const group = groupById.get(d.groupId)
    if (!group) continue
    const newTopIds = newTopsByGroup.get(d.groupId) ?? []
    const firstNewTopName =
      newTopIds.length > 0 ? (nameById.get(newTopIds[0]) ?? 'Otro jugador') : 'Otro jugador'
    const body =
      newTopIds.length > 1
        ? `${firstNewTopName} y ${newTopIds.length - 1} más comparten el #1 en ${group.name}`
        : `${firstNewTopName} es el nuevo #1 en ${group.name}`
    await sendNotificationByType('rank_dethroned', [d.userId], {
      title: '📉 Te pasaron en el ranking',
      body,
      url: `/groups/${group.slug}/leaderboard`,
      tag: `rank-dethroned-${d.groupId}-${resolutionRunId}`,
    })
  }
}

async function notifyClimbedToTop(
  pre: Map<string, Set<string>>,
  post: Map<string, Set<string>>,
  resolutionRunId: string,
): Promise<void> {
  // Users that are in #1 after the run but weren't before. Two cases:
  //   - solo new top (post size 1, was empty or different user)
  //   - new arrival in a tied #1 (post has multiple, user wasn't in pre)
  type Climbed = { groupId: string; userId: string }
  const climbed: Climbed[] = []
  for (const [groupId, postSet] of post) {
    if (postSet.size === 0) continue
    const preSet = pre.get(groupId) ?? new Set<string>()
    for (const uid of postSet) {
      if (!preSet.has(uid)) climbed.push({ groupId, userId: uid })
    }
  }
  if (climbed.length === 0) return

  const affectedGroupIds = [...new Set(climbed.map((c) => c.groupId))]
  const groupRows = await db
    .select({ id: groups.id, slug: groups.slug, name: groups.name })
    .from(groups)
    .where(inArray(groups.id, affectedGroupIds))
  const groupById = new Map(groupRows.map((g) => [g.id, g]))

  for (const c of climbed) {
    const group = groupById.get(c.groupId)
    if (!group) continue
    const postSize = (post.get(c.groupId) ?? new Set()).size
    const body =
      postSize > 1
        ? `Empataste con ${postSize - 1} más por el #1 en ${group.name}`
        : `Llegaste al #1 en ${group.name}`
    await sendNotificationByType('rank_reached_top', [c.userId], {
      title: '🥇 Llegaste al primer puesto',
      body,
      url: `/groups/${group.slug}/leaderboard`,
      tag: `rank-top-${c.groupId}-${resolutionRunId}`,
    })
  }
}
