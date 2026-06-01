import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  categories,
  groupCategories,
  groupMembers,
  groups,
  players,
  predictions,
  profiles,
  teams,
} from '@/db/schema'

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

export async function listAllTeams() {
  return db.select().from(teams).orderBy(teams.name)
}

export type PlayerOption = {
  id: string
  fullName: string
  teamName: string
  teamFlag: string | null
  position: string | null
  dateOfBirth: string | null
}

export async function listAllPlayers(): Promise<PlayerOption[]> {
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
}

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
  | { kind: 'team'; teamName: string; teamFlag: string | null; fifaCode: string | null }
  | { kind: 'team_set'; teams: { name: string; flag: string | null }[] }
  | { kind: 'player'; text: string }
  | { kind: 'empty' }

export type AllPredictionsView = {
  members: AllPredictionsMember[]
  categories: AllPredictionsCategory[]
  // member → category → pick
  picks: Map<string, Map<string, AllPredictionsPick>>
}

export async function getAllGroupPredictions(groupId: string): Promise<AllPredictionsView> {
  const [members, catsRaw, predRows, teamRows] = await Promise.all([
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
  ])

  const teamById = new Map(teamRows.map((t) => [t.id, t]))
  const cats = sortByCategoryOrder(catsRaw)

  const picks: Map<string, Map<string, AllPredictionsPick>> = new Map()
  for (const m of members) picks.set(m.userId, new Map())

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
    picks.get(row.userId)?.set(row.categoryId, pick)
  }

  return { members, categories: cats, picks }
}

/**
 * Plain serialisable shape of getAllGroupPredictions, for passing across the
 * server→client boundary (Maps don't survive RSC props).
 */
export type AllPredictionsViewSerialised = {
  members: AllPredictionsMember[]
  categories: AllPredictionsCategory[]
  picksByMemberCategory: Record<string, Record<string, AllPredictionsPick | undefined>>
}

export function serialiseAllPredictionsView(
  view: AllPredictionsView,
): AllPredictionsViewSerialised {
  const picksByMemberCategory: Record<string, Record<string, AllPredictionsPick | undefined>> = {}
  for (const [memberId, byCat] of view.picks) {
    picksByMemberCategory[memberId] = Object.fromEntries(byCat)
  }
  return {
    members: view.members,
    categories: view.categories,
    picksByMemberCategory,
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
