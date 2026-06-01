import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { categories, groupCategories, predictions, results, teams } from '@/db/schema'
import { sortByCategoryOrder } from '@/features/predictions/queries'

export type LeaderboardRow = {
  userId: string
  displayName: string
  avatarUrl: string | null
  totalPoints: number
  breakdown: Record<string, number>
}

export async function getLeaderboard(groupId: string): Promise<LeaderboardRow[]> {
  const rows = await db.execute<{
    user_id: string
    display_name: string
    avatar_url: string | null
    total_points: number
    breakdown: Record<string, number>
  }>(sql`
    SELECT
      p.id AS user_id,
      p.display_name,
      p.avatar_url,
      COALESCE(v.total_points, 0)::int AS total_points,
      COALESCE(v.breakdown, '{}'::jsonb) AS breakdown
    FROM group_members gm
    JOIN profiles p ON p.id = gm.user_id
    LEFT JOIN v_user_scores v ON v.group_id = gm.group_id AND v.user_id = gm.user_id
    WHERE gm.group_id = ${groupId}::uuid
    ORDER BY total_points DESC, p.display_name ASC
  `)
  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    totalPoints: r.total_points,
    breakdown: r.breakdown,
  }))
}

export type UserCategoryBreakdownRow = {
  key: string
  name: string
  points: number
  status: 'pending' | 'correct' | 'incorrect' | 'no_pick'
  pickLabel: string | null
  resultLabel: string | null
  earnedPoints: number
}

/**
 * Per-category state for a single user in a group: what they picked, what the
 * official result is, whether their pick was correct, and how many points they
 * earned. Used by the personal stats card.
 */
export async function getUserCategoryBreakdown(
  groupId: string,
  userId: string,
): Promise<UserCategoryBreakdownRow[]> {
  const catRows = await db
    .select({
      id: categories.id,
      key: categories.key,
      name: categories.name,
      valueKind: categories.valueKind,
      points: groupCategories.points,
    })
    .from(categories)
    .innerJoin(groupCategories, eq(groupCategories.categoryId, categories.id))
    .where(and(eq(groupCategories.groupId, groupId), eq(groupCategories.enabled, true)))

  const sortedCats = sortByCategoryOrder(catRows)

  const [predRows, resultRows] = await Promise.all([
    db
      .select({
        categoryId: predictions.categoryId,
        teamId: predictions.teamId,
        teamSet: predictions.teamSet,
        playerText: predictions.playerText,
        teamName: teams.name,
      })
      .from(predictions)
      .leftJoin(teams, eq(teams.id, predictions.teamId))
      .where(and(eq(predictions.groupId, groupId), eq(predictions.userId, userId))),
    db
      .select({
        categoryId: results.categoryId,
        teamId: results.teamId,
        teamSet: results.teamSet,
        playerText: results.playerText,
        teamName: teams.name,
      })
      .from(results)
      .leftJoin(teams, eq(teams.id, results.teamId)),
  ])

  const predByCat = new Map(predRows.map((p) => [p.categoryId, p]))
  const resultByCat = new Map(resultRows.map((r) => [r.categoryId, r]))

  return sortedCats.map((c) => {
    const pick = predByCat.get(c.id)
    const result = resultByCat.get(c.id)
    const pickLabel = pick
      ? (pick.teamName ??
        pick.playerText ??
        (Array.isArray(pick.teamSet) && pick.teamSet.length > 0
          ? `${pick.teamSet.length} equipos`
          : null))
      : null
    const resultLabel = result
      ? (result.teamName ??
        result.playerText ??
        (Array.isArray(result.teamSet) && result.teamSet.length > 0
          ? `${result.teamSet.length} equipos`
          : null))
      : null

    let status: UserCategoryBreakdownRow['status'] = 'pending'
    let earnedPoints = 0

    if (result) {
      if (!pick) {
        status = 'no_pick'
      } else if (c.valueKind === 'team') {
        const correct = pick.teamId === result.teamId
        status = correct ? 'correct' : 'incorrect'
        if (correct) earnedPoints = c.points
      } else if (c.valueKind === 'player') {
        const pickPlayer = (pick.playerText ?? '').trim().toLowerCase()
        const resultPlayer = (result.playerText ?? '').trim().toLowerCase()
        const correct = pickPlayer && resultPlayer && pickPlayer === resultPlayer
        status = correct ? 'correct' : 'incorrect'
        if (correct) earnedPoints = c.points
      } else if (c.valueKind === 'team_set') {
        const pickSet = new Set((pick.teamSet as string[] | null) ?? [])
        const resultSet = new Set((result.teamSet as string[] | null) ?? [])
        let hits = 0
        for (const id of pickSet) if (resultSet.has(id)) hits++
        if (hits === resultSet.size && pickSet.size === resultSet.size) {
          status = 'correct'
          earnedPoints = c.points
        } else if (hits > 0) {
          status = 'correct'
          earnedPoints = hits * c.points
        } else {
          status = 'incorrect'
        }
      }
    }

    return {
      key: c.key,
      name: c.name,
      points: c.points,
      status,
      pickLabel,
      resultLabel,
      earnedPoints,
    }
  })
}

export type RecentCorrectPick = {
  categoryKey: string
  categoryName: string
  earnedPoints: number
}

/**
 * Returns the user's picks that became correct since `since`. Used by the
 * celebration component on the group page to fire confetti when there are
 * brand-new wins to celebrate.
 */
export async function getNewlyResolvedPicksForUser(
  groupId: string,
  userId: string,
  since: Date | null,
): Promise<RecentCorrectPick[]> {
  // Only look at results resolved after `since` to keep the comparison cheap.
  const recentResults = await db
    .select({
      categoryId: results.categoryId,
      teamId: results.teamId,
      teamSet: results.teamSet,
      playerText: results.playerText,
    })
    .from(results)
    .where(since ? gt(results.resolvedAt, since) : undefined)
  if (recentResults.length === 0) return []

  const catIds = recentResults.map((r) => r.categoryId)
  const [catRows, predRows] = await Promise.all([
    db
      .select({
        id: categories.id,
        key: categories.key,
        name: categories.name,
        valueKind: categories.valueKind,
        points: groupCategories.points,
      })
      .from(categories)
      .innerJoin(groupCategories, eq(groupCategories.categoryId, categories.id))
      .where(eq(groupCategories.groupId, groupId)),
    db
      .select({
        categoryId: predictions.categoryId,
        teamId: predictions.teamId,
        teamSet: predictions.teamSet,
        playerText: predictions.playerText,
      })
      .from(predictions)
      .where(
        and(eq(predictions.groupId, groupId), eq(predictions.userId, userId)),
      ),
  ])

  const catMap = new Map(catRows.map((c) => [c.id, c]))
  const predMap = new Map(predRows.map((p) => [p.categoryId, p]))

  const wins: RecentCorrectPick[] = []
  for (const result of recentResults) {
    if (!catIds.includes(result.categoryId)) continue
    const cat = catMap.get(result.categoryId)
    const pick = predMap.get(result.categoryId)
    if (!cat || !pick) continue

    let correct = false
    let earned = 0
    if (cat.valueKind === 'team' && pick.teamId && result.teamId) {
      correct = pick.teamId === result.teamId
      if (correct) earned = cat.points
    } else if (cat.valueKind === 'player' && pick.playerText && result.playerText) {
      const pickPlayer = pick.playerText.trim().toLowerCase()
      const resultPlayer = result.playerText.trim().toLowerCase()
      correct = pickPlayer === resultPlayer
      if (correct) earned = cat.points
    } else if (cat.valueKind === 'team_set') {
      const pickSet = new Set((pick.teamSet as string[] | null) ?? [])
      const resultSet = new Set((result.teamSet as string[] | null) ?? [])
      let hits = 0
      for (const id of pickSet) if (resultSet.has(id)) hits++
      if (hits > 0) {
        correct = true
        earned = hits * cat.points
      }
    }

    if (correct && earned > 0) {
      wins.push({ categoryKey: cat.key, categoryName: cat.name, earnedPoints: earned })
    }
  }
  return wins
}
