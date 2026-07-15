import { and, asc, eq } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { db } from '@/db'
import {
  categories,
  groupCategories,
  groupMembers,
  groups,
  players,
  predictions,
  profiles,
  results,
  teams,
} from '@/db/schema'
import {
  getEliminationContext,
  isPlayerPickDead,
  isTeamPickDead,
  normalizePlayerText,
} from '@/features/tournament/eliminations'

/**
 * Canonical order shown to users. Postgres doesn't guarantee a row order
 * without ORDER BY, and re-seeding shuffled the physical layout, which made
 * the predict form jump around between sessions. Both the form and the
 * leaderboard breakdown sort with this list.
 */
export const CATEGORY_ORDER = [
  'champion',
  'runner_up',
  'third_place',
  'finalists',
  'top_5',
  'revelation',
  'disappointment',
  'top_scoring_team',
  'most_conceded_team',
  'top_scorer_player',
  'top_assists_player',
  'golden_ball',
  'golden_glove',
  'young_player',
] as const

export function sortByCategoryOrder<T extends { key: string }>(rows: T[]): T[] {
  const index = (k: string) => {
    const i = (CATEGORY_ORDER as readonly string[]).indexOf(k)
    return i === -1 ? CATEGORY_ORDER.length : i
  }
  return [...rows].sort((a, b) => index(a.key) - index(b.key))
}

export type PredictionFormCategory = {
  id: string
  key: string
  name: string
  description: string | null
  valueKind: 'team' | 'player' | 'team_set'
  points: number
  metadata: Record<string, unknown> | null
  current: {
    teamId: string | null
    teamSet: string[] | null
    playerText: string | null
  } | null
}

export async function getGroupBySlug(slug: string) {
  return db.query.groups.findFirst({ where: eq(groups.slug, slug) })
}

export async function getMembership(groupId: string, userId: string) {
  return db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
  })
}

export async function listMembers(groupId: string) {
  return db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, groupId),
    with: { user: undefined },
  } as never)
}

// Cross-request cache: same 48 rows for every viewer, only invalidated by
// revalidateTag('teams') after a re-seed. 1h TTL is fine — pre-Mundial seeds
// are deploy-time only; once tournament starts the names don't change.
export const listAllTeams = unstable_cache(
  async () => db.select().from(teams).orderBy(teams.name),
  ['list-all-teams'],
  { revalidate: 3600, tags: ['teams'] },
)

export type PlayerOption = {
  id: string
  fullName: string
  teamName: string
  teamFlag: string | null
  position: string | null
  dateOfBirth: string | null
}

export const listAllPlayers = unstable_cache(
  async (): Promise<PlayerOption[]> => {
    const rows = await db
      .select({
        id: players.id,
        fullName: players.fullName,
        teamName: teams.name,
        teamFlag: teams.flagEmoji,
        position: players.position,
        dateOfBirth: players.dateOfBirth,
      })
      .from(players)
      .leftJoin(teams, eq(teams.id, players.teamId))
      .orderBy(asc(players.fullName))
    return rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      teamName: r.teamName ?? '',
      teamFlag: r.teamFlag,
      position: r.position,
      dateOfBirth: r.dateOfBirth,
    }))
  },
  ['list-all-players'],
  { revalidate: 3600, tags: ['players'] },
)

export async function getPredictionForm(
  groupId: string,
  userId: string,
): Promise<PredictionFormCategory[]> {
  const rows = await db
    .select({
      id: categories.id,
      key: categories.key,
      name: categories.name,
      description: categories.description,
      valueKind: categories.valueKind,
      points: groupCategories.points,
      enabled: groupCategories.enabled,
      metadata: categories.metadata,
    })
    .from(categories)
    .innerJoin(groupCategories, eq(groupCategories.categoryId, categories.id))
    .where(and(eq(groupCategories.groupId, groupId), eq(groupCategories.enabled, true)))

  const existing = await db
    .select({
      categoryId: predictions.categoryId,
      teamId: predictions.teamId,
      teamSet: predictions.teamSet,
      playerText: predictions.playerText,
    })
    .from(predictions)
    .where(and(eq(predictions.groupId, groupId), eq(predictions.userId, userId)))

  const map = new Map(existing.map((e) => [e.categoryId, e]))

  const mapped = rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    valueKind: r.valueKind,
    points: r.points,
    metadata: r.metadata as Record<string, unknown> | null,
    current: map.has(r.id)
      ? {
          teamId: map.get(r.id)?.teamId ?? null,
          teamSet: (map.get(r.id)?.teamSet as string[] | null) ?? null,
          playerText: map.get(r.id)?.playerText ?? null,
        }
      : null,
  }))
  return sortByCategoryOrder(mapped)
}

export type AllPredictionsMember = {
  userId: string
  displayName: string
  avatarUrl: string | null
}

export type AllPredictionsCategory = {
  id: string
  key: string
  name: string
  valueKind: 'team' | 'player' | 'team_set'
  points: number
}

export type AllPredictionsPick =
  | {
      kind: 'team'
      teamName: string
      teamFlag: string | null
      fifaCode: string | null
      /** Ya no puede ganar la categoría (eliminado o resultado en contra). */
      dead?: boolean
    }
  | { kind: 'team_set'; teams: { name: string; flag: string | null; dead?: boolean }[] }
  | { kind: 'player'; text: string; dead?: boolean }
  | { kind: 'empty' }

/**
 * Estado definitivo de un pick: 'failed' = ya no suma nada (resuelto sin
 * acierto o imposible), 'won' = acierto confirmado, 'partial' = team_set
 * resuelto con aciertos parciales. Sin fate = sigue en juego.
 */
export type PickFate = 'won' | 'partial' | 'failed'

/**
 * "La Carta Perfecta": el apostador perfecto. Un pick por categoría armado
 * desde la tabla `results` (la respuesta oficial). Las categorías sin resolver
 * quedan como pick `empty` y se muestran como "Pendiente".
 */
export type PerfectCard = {
  picksByCategory: Record<string, AllPredictionsPick | undefined>
  resolvedCount: number
  totalCount: number
}

export type AllPredictionsView = {
  members: AllPredictionsMember[]
  categories: AllPredictionsCategory[]
  // member → category → pick
  picks: Map<string, Map<string, AllPredictionsPick>>
  // member → category → fate (solo picks ya decididos)
  fateByMemberCategory: Record<string, Record<string, PickFate | undefined>>
  // El apostador perfecto: respuesta oficial por categoría.
  perfect: PerfectCard
}

type ResultRow = {
  categoryId: string
  teamId: string | null
  teamSet: string[] | null
  playerText: string | null
}

/**
 * Construye el pick "correcto" de una categoría desde su resultado oficial.
 * Sin resultado (o categoría sin datos aún) → pick `empty`. No calcula `dead`
 * ni `fate`: por definición esta es la respuesta ganadora.
 */
function buildResultPick(
  cat: AllPredictionsCategory,
  result: ResultRow | undefined,
  teamById: Map<string, { id: string; name: string; flag: string | null }>,
): AllPredictionsPick {
  if (!result) return { kind: 'empty' }
  if (cat.valueKind === 'team' && result.teamId) {
    const t = teamById.get(result.teamId)
    if (!t) return { kind: 'empty' }
    return { kind: 'team', teamName: t.name, teamFlag: t.flag, fifaCode: null }
  }
  if (cat.valueKind === 'team_set' && result.teamSet) {
    const teams = (result.teamSet as string[])
      .map((id) => teamById.get(id))
      .filter((t): t is { id: string; name: string; flag: string | null } => !!t)
      .map((t) => ({ name: t.name, flag: t.flag }))
    return teams.length > 0 ? { kind: 'team_set', teams } : { kind: 'empty' }
  }
  if (cat.valueKind === 'player' && result.playerText) {
    return { kind: 'player', text: result.playerText }
  }
  return { kind: 'empty' }
}

export async function getAllGroupPredictions(groupId: string): Promise<AllPredictionsView> {
  const [members, catsRaw, predRows, teamRows, resultRows, elimCtx] = await Promise.all([
    db
      .select({
        userId: profiles.id,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
      })
      .from(groupMembers)
      .innerJoin(profiles, eq(profiles.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(asc(profiles.displayName)),
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
      .where(and(eq(groupCategories.groupId, groupId), eq(groupCategories.enabled, true))),
    db
      .select({
        userId: predictions.userId,
        categoryId: predictions.categoryId,
        teamId: predictions.teamId,
        teamSet: predictions.teamSet,
        playerText: predictions.playerText,
        teamName: teams.name,
        teamFlag: teams.flagEmoji,
        teamFifa: teams.fifaCode,
      })
      .from(predictions)
      .leftJoin(teams, eq(teams.id, predictions.teamId))
      .where(eq(predictions.groupId, groupId)),
    db.select({ id: teams.id, name: teams.name, flag: teams.flagEmoji }).from(teams),
    db
      .select({
        categoryId: results.categoryId,
        teamId: results.teamId,
        teamSet: results.teamSet,
        playerText: results.playerText,
      })
      .from(results),
    getEliminationContext(),
  ])

  const teamById = new Map(teamRows.map((t) => [t.id, t]))
  const resultByCat = new Map(resultRows.map((r) => [r.categoryId, r]))
  const cats = sortByCategoryOrder(catsRaw)

  const picks: Map<string, Map<string, AllPredictionsPick>> = new Map()
  for (const m of members) picks.set(m.userId, new Map())
  const fateByMemberCategory: AllPredictionsView['fateByMemberCategory'] = {}

  for (const row of predRows) {
    const cat = cats.find((c) => c.id === row.categoryId)
    if (!cat) continue
    const result = resultByCat.get(row.categoryId)
    let pick: AllPredictionsPick = { kind: 'empty' }
    let fate: PickFate | undefined

    if (cat.valueKind === 'team' && row.teamId && row.teamName) {
      if (result?.teamId) {
        fate = result.teamId === row.teamId ? 'won' : 'failed'
      } else if (isTeamPickDead(cat.key, row.teamId, elimCtx)) {
        fate = 'failed'
      }
      pick = {
        kind: 'team',
        teamName: row.teamName,
        teamFlag: row.teamFlag,
        fifaCode: row.teamFifa,
        dead: fate === 'failed' || undefined,
      }
    } else if (cat.valueKind === 'team_set' && row.teamSet) {
      const resultSet = result?.teamSet ? new Set(result.teamSet as string[]) : null
      const ids = (row.teamSet as string[]).filter((id) => teamById.has(id))
      const items = ids.map((id) => {
        const t = teamById.get(id) as { id: string; name: string; flag: string | null }
        // Resuelto: muerto todo lo que no está en el resultado. Sin resolver:
        // muerto lo matemáticamente imposible.
        const dead = resultSet ? !resultSet.has(id) : isTeamPickDead(cat.key, id, elimCtx)
        return { name: t.name, flag: t.flag, dead: dead || undefined }
      })
      if (resultSet) {
        const hits = ids.filter((id) => resultSet.has(id)).length
        fate =
          hits === 0 ? 'failed' : hits === ids.length && hits === resultSet.size ? 'won' : 'partial'
      } else if (items.length > 0 && items.every((t) => t.dead)) {
        fate = 'failed'
      }
      pick = { kind: 'team_set', teams: items }
    } else if (cat.valueKind === 'player' && row.playerText) {
      if (result?.playerText) {
        fate =
          normalizePlayerText(row.playerText) === normalizePlayerText(result.playerText)
            ? 'won'
            : 'failed'
      } else if (isPlayerPickDead(cat.key, row.playerText, elimCtx)) {
        fate = 'failed'
      }
      pick = { kind: 'player', text: row.playerText, dead: fate === 'failed' || undefined }
    }

    picks.get(row.userId)?.set(row.categoryId, pick)
    if (fate) {
      const byCat = fateByMemberCategory[row.userId] ?? {}
      byCat[row.categoryId] = fate
      fateByMemberCategory[row.userId] = byCat
    }
  }

  // La Carta Perfecta: pick oficial por categoría, en el mismo orden.
  const perfectPicks: Record<string, AllPredictionsPick | undefined> = {}
  let resolvedCount = 0
  for (const cat of cats) {
    const pick = buildResultPick(cat, resultByCat.get(cat.id), teamById)
    perfectPicks[cat.id] = pick
    if (pick.kind !== 'empty') resolvedCount++
  }
  const perfect: PerfectCard = {
    picksByCategory: perfectPicks,
    resolvedCount,
    totalCount: cats.length,
  }

  return { members, categories: cats, picks, fateByMemberCategory, perfect }
}

export async function getPredictionIdsByMemberCategory(
  groupId: string,
): Promise<Record<string, Record<string, string | undefined>>> {
  const rows = await db
    .select({
      id: predictions.id,
      userId: predictions.userId,
      categoryId: predictions.categoryId,
    })
    .from(predictions)
    .where(eq(predictions.groupId, groupId))
  const out: Record<string, Record<string, string | undefined>> = {}
  for (const r of rows) {
    if (!out[r.userId]) out[r.userId] = {}
    out[r.userId][r.categoryId] = r.id
  }
  return out
}

/**
 * Plain serialisable shape of getAllGroupPredictions, for passing across the
 * server→client boundary (Maps don't survive RSC props).
 */
export type AllPredictionsViewSerialised = {
  members: AllPredictionsMember[]
  categories: AllPredictionsCategory[]
  picksByMemberCategory: Record<string, Record<string, AllPredictionsPick | undefined>>
  predictionIdsByMemberCategory: Record<string, Record<string, string | undefined>>
  fateByMemberCategory: Record<string, Record<string, PickFate | undefined>>
  perfect: PerfectCard
}

export function serialiseAllPredictionsView(
  view: AllPredictionsView,
  predictionIdsByMemberCategory?: Record<string, Record<string, string | undefined>>,
): AllPredictionsViewSerialised {
  const picksByMemberCategory: Record<string, Record<string, AllPredictionsPick | undefined>> = {}
  for (const [memberId, byCat] of view.picks) {
    picksByMemberCategory[memberId] = Object.fromEntries(byCat)
  }
  return {
    members: view.members,
    categories: view.categories,
    picksByMemberCategory,
    predictionIdsByMemberCategory: predictionIdsByMemberCategory ?? {},
    fateByMemberCategory: view.fateByMemberCategory,
    perfect: view.perfect,
  }
}

export type UserComprobante = {
  categories: AllPredictionsCategory[]
  picks: Map<string, AllPredictionsPick>
  /** Most recent updatedAt across the user's predictions for this group. */
  lastUpdatedAt: Date | null
  filledCount: number
  totalCount: number
}

export async function getUserComprobante(
  groupId: string,
  userId: string,
): Promise<UserComprobante> {
  const [catsRaw, predRows, teamRows] = await Promise.all([
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
      .where(and(eq(groupCategories.groupId, groupId), eq(groupCategories.enabled, true))),
    db
      .select({
        categoryId: predictions.categoryId,
        teamId: predictions.teamId,
        teamSet: predictions.teamSet,
        playerText: predictions.playerText,
        updatedAt: predictions.updatedAt,
        teamName: teams.name,
        teamFlag: teams.flagEmoji,
        teamFifa: teams.fifaCode,
      })
      .from(predictions)
      .leftJoin(teams, eq(teams.id, predictions.teamId))
      .where(and(eq(predictions.groupId, groupId), eq(predictions.userId, userId))),
    db.select({ id: teams.id, name: teams.name, flag: teams.flagEmoji }).from(teams),
  ])

  const teamById = new Map(teamRows.map((t) => [t.id, t]))
  const cats = sortByCategoryOrder(catsRaw)
  const picks = new Map<string, AllPredictionsPick>()
  let lastUpdatedAt: Date | null = null
  let filledCount = 0

  for (const row of predRows) {
    const cat = cats.find((c) => c.id === row.categoryId)
    if (!cat) continue
    let pick: AllPredictionsPick = { kind: 'empty' }
    if (cat.valueKind === 'team' && row.teamId && row.teamName) {
      pick = {
        kind: 'team',
        teamName: row.teamName,
        teamFlag: row.teamFlag,
        fifaCode: row.teamFifa,
      }
    } else if (cat.valueKind === 'team_set' && row.teamSet) {
      const items = (row.teamSet as string[])
        .map((id) => teamById.get(id))
        .filter((t): t is { id: string; name: string; flag: string | null } => !!t)
        .map((t) => ({ name: t.name, flag: t.flag }))
      pick = { kind: 'team_set', teams: items }
    } else if (cat.valueKind === 'player' && row.playerText) {
      pick = { kind: 'player', text: row.playerText }
    }
    if (pick.kind !== 'empty') filledCount++
    picks.set(row.categoryId, pick)
    if (!lastUpdatedAt || row.updatedAt > lastUpdatedAt) {
      lastUpdatedAt = row.updatedAt
    }
  }

  return { categories: cats, picks, lastUpdatedAt, filledCount, totalCount: cats.length }
}
