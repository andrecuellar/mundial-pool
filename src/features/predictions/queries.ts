import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  categories,
  groupCategories,
  groupMembers,
  groups,
  players,
  predictions,
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
