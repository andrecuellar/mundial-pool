import { and, asc, desc, eq } from 'drizzle-orm'
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
  buildTournamentInputs,
  computeRevelationAndDisappointment,
  computeTournamentRanks,
} from '@/features/scoring/tournament-rank'
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
 * Estado de un pick de La Carta Perfecta: 'confirmed' = respuesta oficial ya
 * resuelta (tabla `results`); 'provisional' = proyección desde el estado actual
 * del torneo, todavía puede cambiar. Sin estado = categoría pendiente.
 */
export type PerfectPickStatus = 'confirmed' | 'provisional'

/**
 * "La Carta Perfecta": el apostador perfecto. Un pick por categoría. Las
 * confirmadas salen de la tabla `results`; las provisionales se proyectan del
 * estado del torneo (revelación, decepción, top 5, finalistas y goleador/
 * asistente líder). Las que no tienen respuesta ni proyección quedan `empty`
 * y se muestran como "Pendiente".
 */
export type PerfectCard = {
  picksByCategory: Record<string, AllPredictionsPick | undefined>
  statusByCategory: Record<string, PerfectPickStatus | undefined>
  confirmedCount: number
  provisionalCount: number
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

/** Proyección "en vivo" del torneo para categorías aún sin resultado oficial. */
type ProvisionalContext = {
  revelationId: string | null
  disappointmentId: string | null
  top5Ids: string[]
  finalistIds: string[]
  topScorerText: string | null
  topAssistsText: string | null
}

/**
 * Pick proyectado desde el estado actual del torneo para una categoría que aún
 * no se resolvió. Devuelve `null` cuando no hay proyección fiable o la categoría
 * no es proyectable (campeón, subcampeón, 3.er puesto y premios FIFA quedan
 * pendientes hasta jugarse/definirse manualmente).
 */
function buildProvisionalPick(
  cat: AllPredictionsCategory,
  ctx: ProvisionalContext,
  teamById: Map<string, { id: string; name: string; flag: string | null }>,
): AllPredictionsPick | null {
  const teamPick = (id: string | null): AllPredictionsPick | null => {
    if (!id) return null
    const t = teamById.get(id)
    return t ? { kind: 'team', teamName: t.name, teamFlag: t.flag, fifaCode: null } : null
  }
  const teamSetPick = (ids: string[]): AllPredictionsPick | null => {
    const teams = ids
      .map((id) => teamById.get(id))
      .filter((t): t is { id: string; name: string; flag: string | null } => !!t)
      .map((t) => ({ name: t.name, flag: t.flag }))
    return teams.length > 0 ? { kind: 'team_set', teams } : null
  }
  switch (cat.key) {
    case 'revelation':
      return teamPick(ctx.revelationId)
    case 'disappointment':
      return teamPick(ctx.disappointmentId)
    case 'top_5':
      return teamSetPick(ctx.top5Ids)
    case 'finalists':
      return teamSetPick(ctx.finalistIds)
    case 'top_scorer_player':
      return ctx.topScorerText ? { kind: 'player', text: ctx.topScorerText } : null
    case 'top_assists_player':
      return ctx.topAssistsText ? { kind: 'player', text: ctx.topAssistsText } : null
    default:
      return null
  }
}

export async function getAllGroupPredictions(groupId: string): Promise<AllPredictionsView> {
  const [members, catsRaw, predRows, teamRows, resultRows, elimCtx, topScorerRow, topAssistsRow] =
    await Promise.all([
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
      db.select().from(teams),
      db
        .select({
          categoryId: results.categoryId,
          teamId: results.teamId,
          teamSet: results.teamSet,
          playerText: results.playerText,
        })
        .from(results),
      getEliminationContext(),
      db
        .select({ fullName: players.fullName, goals: players.goals })
        .from(players)
        .orderBy(desc(players.goals))
        .limit(1),
      db
        .select({ fullName: players.fullName, assists: players.assists })
        .from(players)
        .orderBy(desc(players.assists))
        .limit(1),
    ])

  const teamById = new Map(
    teamRows.map((t) => [t.id, { id: t.id, name: t.name, flag: t.flagEmoji }]),
  )
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

  // Proyección provisional del torneo (mismas funciones que el resolutor del
  // cron, pero sin exigir que todo esté "decided"): adelanta la respuesta de las
  // categorías que aún no se resolvieron oficialmente. Solo marcamos revelación/
  // decepción con un delta real, igual que la tabla de selecciones.
  const { inputs } = buildTournamentInputs(teamRows)
  const ranks = computeTournamentRanks(inputs)
  const revDis = computeRevelationAndDisappointment(inputs)
  const provisional: ProvisionalContext = {
    revelationId: revDis && revDis.revelation.delta > 0 ? revDis.revelation.teamId : null,
    disappointmentId:
      revDis && revDis.disappointment.delta < 0 ? revDis.disappointment.teamId : null,
    top5Ids: ranks.filter((r) => r.tournamentRank <= 5).map((r) => r.teamId),
    // Finalistas provisionales = quienes ya están en la final (ganaron su semi o
    // ya la jugaron). Puede ser uno solo mientras falte jugarse la otra semi.
    finalistIds: teamRows
      .filter(
        (t) =>
          t.reachedRound === 'alive_final' ||
          t.reachedRound === 'champion' ||
          t.reachedRound === 'runner_up',
      )
      .map((t) => t.id),
    topScorerText: topScorerRow[0] && topScorerRow[0].goals > 0 ? topScorerRow[0].fullName : null,
    topAssistsText:
      topAssistsRow[0] && topAssistsRow[0].assists > 0 ? topAssistsRow[0].fullName : null,
  }

  // La Carta Perfecta: por categoría, primero la respuesta oficial; si no hay,
  // la proyección provisional; si tampoco, queda pendiente.
  const perfectPicks: Record<string, AllPredictionsPick | undefined> = {}
  const perfectStatus: Record<string, PerfectPickStatus | undefined> = {}
  let confirmedCount = 0
  let provisionalCount = 0
  for (const cat of cats) {
    const official = buildResultPick(cat, resultByCat.get(cat.id), teamById)
    if (official.kind !== 'empty') {
      perfectPicks[cat.id] = official
      perfectStatus[cat.id] = 'confirmed'
      confirmedCount++
      continue
    }
    const prov = buildProvisionalPick(cat, provisional, teamById)
    if (prov && prov.kind !== 'empty') {
      perfectPicks[cat.id] = prov
      perfectStatus[cat.id] = 'provisional'
      provisionalCount++
      continue
    }
    perfectPicks[cat.id] = { kind: 'empty' }
  }
  const perfect: PerfectCard = {
    picksByCategory: perfectPicks,
    statusByCategory: perfectStatus,
    confirmedCount,
    provisionalCount,
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
