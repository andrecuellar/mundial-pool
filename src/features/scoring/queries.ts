import { and, eq, gt, sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { db } from '@/db'
import {
  categories,
  groupCategories,
  groupMembers,
  groups,
  predictions,
  results,
  teams,
} from '@/db/schema'
import { sortByCategoryOrder } from '@/features/predictions/queries'
import { compareRanked } from '@/features/scoring/rank'
import { getEliminationContext, isPickDead } from '@/features/tournament/eliminations'

export type LeaderboardRow = {
  userId: string
  displayName: string
  avatarUrl: string | null
  totalPoints: number
  breakdown: Record<string, number>
}

// Wrapped in React cache so it's deduped within a single request: the group
// page calls it directly via Promise.all and computePayout calls it again
// internally — without cache that's two DB hits per render.
export const getLeaderboard = cache(async (groupId: string): Promise<LeaderboardRow[]> => {
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
})

/** Categorías con resultado oficial cargado — sus celdas ya son definitivas. */
export async function getResolvedCategoryIds(): Promise<string[]> {
  const rows = await db.select({ categoryId: results.categoryId }).from(results)
  return rows.map((r) => r.categoryId)
}

/**
 * Por usuario, las categorías SIN resolver cuyo pick ya no puede sumar ni un
 * punto: el equipo/jugador elegido quedó matemáticamente eliminado, o la
 * casilla quedó vacía después del cierre. La tabla de líderes las muestra como
 * 0 definitivo en vez de "—" pendiente. Se recalcula en cada request desde el
 * estado del bracket que el cron diario mantiene al día.
 */
export async function getLostCategoryIdsByUser(
  groupId: string,
  lockAt: Date,
): Promise<Record<string, string[]>> {
  const [catRows, resolvedIds, memberRows, predRows, ctx] = await Promise.all([
    db
      .select({ id: categories.id, key: categories.key, valueKind: categories.valueKind })
      .from(categories)
      .innerJoin(groupCategories, eq(groupCategories.categoryId, categories.id))
      .where(and(eq(groupCategories.groupId, groupId), eq(groupCategories.enabled, true))),
    getResolvedCategoryIds(),
    db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId)),
    db
      .select({
        userId: predictions.userId,
        categoryId: predictions.categoryId,
        teamId: predictions.teamId,
        teamSet: predictions.teamSet,
        playerText: predictions.playerText,
      })
      .from(predictions)
      .where(eq(predictions.groupId, groupId)),
    getEliminationContext(),
  ])

  const resolved = new Set(resolvedIds)
  const unresolvedCats = catRows.filter((c) => !resolved.has(c.id))
  const locked = new Date() >= lockAt
  const predByUserCat = new Map(predRows.map((p) => [`${p.userId}:${p.categoryId}`, p]))

  const out: Record<string, string[]> = {}
  for (const m of memberRows) {
    const lost: string[] = []
    for (const c of unresolvedCats) {
      const pick = predByUserCat.get(`${m.userId}:${c.id}`)
      const hasValue =
        !!pick &&
        (pick.teamId != null ||
          pick.playerText != null ||
          (Array.isArray(pick.teamSet) && pick.teamSet.length > 0))
      if (!hasValue) {
        // Tras el cierre una casilla vacía nunca podrá sumar.
        if (locked) lost.push(c.id)
        continue
      }
      const dead = isPickDead(
        c,
        {
          teamId: pick.teamId,
          teamSet: pick.teamSet as string[] | null,
          playerText: pick.playerText,
        },
        ctx,
      )
      if (dead) lost.push(c.id)
    }
    if (lost.length > 0) out[m.userId] = lost
  }
  return out
}

export type RankedLeaderboardRow = LeaderboardRow & {
  /** Categorías con puntos ganados (> 0). */
  correctCount: number
  /** Ceros definitivos: categorías resueltas sin acierto o con pick imposible/vacío post-cierre. */
  failedCount: number
  /** Banderas (únicas) de las selecciones elegidas que ya quedaron fuera del torneo. */
  deadFlags: string[]
}

/**
 * Leaderboard con el criterio de desempate por fallos: a igualdad de puntos va
 * más arriba quien tiene menos ceros definitivos. Es la fuente de verdad para
 * el orden de la tabla, la posición personal y el reparto del pozo — usar esto
 * en vez de getLeaderboard en cualquier superficie que muestre puestos.
 */
const computeRankedLeaderboard = async (groupId: string): Promise<RankedLeaderboardRow[]> => {
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    columns: { predictionsLockAt: true },
  })
  const lockAt = group?.predictionsLockAt ?? new Date(0)

  const [rows, lostByUser, resolvedIds, catRows, predRows, teamRows, ctx] = await Promise.all([
    getLeaderboard(groupId),
    getLostCategoryIdsByUser(groupId, lockAt),
    getResolvedCategoryIds(),
    db
      .select({ id: categories.id })
      .from(categories)
      .innerJoin(groupCategories, eq(groupCategories.categoryId, categories.id))
      .where(and(eq(groupCategories.groupId, groupId), eq(groupCategories.enabled, true))),
    db
      .select({
        userId: predictions.userId,
        categoryId: predictions.categoryId,
        teamId: predictions.teamId,
        teamSet: predictions.teamSet,
      })
      .from(predictions)
      .where(eq(predictions.groupId, groupId)),
    db.select({ id: teams.id, flagEmoji: teams.flagEmoji }).from(teams),
    getEliminationContext(),
  ])

  const resolved = new Set(resolvedIds)
  const enabledCatIds = new Set(catRows.map((c) => c.id))
  const flagByTeamId = new Map(teamRows.map((t) => [t.id, t.flagEmoji]))

  // Banderas de selecciones eliminadas del torneo que el usuario eligió en
  // cualquier categoría de equipos. Dedupe por bandera (elegir a Portugal
  // campeón Y finalista cuenta una sola vez en la carta compartible).
  const deadFlagsByUser = new Map<string, string[]>()
  for (const p of predRows) {
    if (!enabledCatIds.has(p.categoryId)) continue
    const teamIds: string[] = []
    if (p.teamId) teamIds.push(p.teamId)
    if (Array.isArray(p.teamSet)) teamIds.push(...(p.teamSet as string[]))
    for (const tid of teamIds) {
      const fate = ctx.fatesByTeamId[tid]
      if (!fate || fate.stillPlaying) continue
      const flag = flagByTeamId.get(tid)
      if (!flag) continue
      const arr = deadFlagsByUser.get(p.userId) ?? []
      if (!arr.includes(flag)) arr.push(flag)
      deadFlagsByUser.set(p.userId, arr)
    }
  }

  const ranked = rows.map((r) => {
    const lost = new Set(lostByUser[r.userId] ?? [])
    let correctCount = 0
    let failedCount = 0
    for (const c of catRows) {
      const pts = r.breakdown[c.id] ?? 0
      if (pts > 0) correctCount++
      else if (resolved.has(c.id) || lost.has(c.id)) failedCount++
    }
    return {
      ...r,
      correctCount,
      failedCount,
      deadFlags: deadFlagsByUser.get(r.userId) ?? [],
    }
  })
  return ranked.sort(compareRanked)
}

// unstable_cache colapsa las ~10 queries internas a una sola lectura del Data
// Cache. revalidate 60s: la tabla solo cambia cuando el cron resuelve (una vez
// al día) o alguien predice antes del cierre — 60s de staleness es invisible, y
// es el cambio que corta de raíz el pool thrashing / conexiones huérfanas
// (menos queries por request = requests más cortos = casi nunca se matan a
// mitad). Los tags dejan que la resolución la invalide al instante.
const cachedRankedLeaderboard = unstable_cache(
  computeRankedLeaderboard,
  ['ranked-leaderboard-v1'],
  { revalidate: 60, tags: ['teams', 'players'] },
)

// React cache dedupe intra-request: la página y computePayout la piden en el
// mismo render y así solo hay una lectura del Data Cache.
export const getRankedLeaderboard = cache(
  (groupId: string): Promise<RankedLeaderboardRow[]> => cachedRankedLeaderboard(groupId),
)

export type UserCategoryBreakdownRow = {
  key: string
  name: string
  points: number
  status: 'pending' | 'correct' | 'partial' | 'incorrect' | 'no_pick' | 'lost'
  pickLabel: string | null
  resultLabel: string | null
  earnedPoints: number
}

/**
 * Per-category state for a single user in a group: what they picked, what the
 * official result is, whether their pick was correct, and how many points they
 * earned. Used by the personal stats card.
 */
// Cacheado por (groupId, userId) 60s: es el segundo bloque más pesado (~3-4
// queries) y por-usuario. Mismo criterio de staleness que el leaderboard.
export const getUserCategoryBreakdown = unstable_cache(
  async (groupId: string, userId: string): Promise<UserCategoryBreakdownRow[]> => {
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

    const [predRows, resultRows, elimCtx] = await Promise.all([
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
      getEliminationContext(),
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
          // Always per-team: the leaderboard view does the same multiplication.
          // Exact match → 'correct', any partial overlap → 'partial', zero
          // → 'incorrect'. Earned points come from hits * points either way.
          earnedPoints = hits * c.points
          if (hits === resultSet.size && pickSet.size === resultSet.size) {
            status = 'correct'
          } else if (hits > 0) {
            status = 'partial'
          } else {
            status = 'incorrect'
          }
        }
      } else if (pick) {
        // Sin resultado oficial todavía, pero el pick puede estar ya muerto
        // (equipo eliminado, jugador sin chance) → 0 asegurado.
        const dead = isPickDead(
          { key: c.key, valueKind: c.valueKind },
          {
            teamId: pick.teamId,
            teamSet: pick.teamSet as string[] | null,
            playerText: pick.playerText,
          },
          elimCtx,
        )
        if (dead) status = 'lost'
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
  },
  ['user-category-breakdown-v1'],
  { revalidate: 60, tags: ['teams', 'players'] },
)

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
      .where(and(eq(predictions.groupId, groupId), eq(predictions.userId, userId))),
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
