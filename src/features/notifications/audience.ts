import 'server-only'
import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  groupMembers,
  groups,
  poolTransactions,
  predictions,
  profiles,
} from '@/db/schema'

// Discriminated union persisted as JSON in admin_broadcasts.audienceFilter.
// `groupId === null` for non_payers / non_predictors means "across every
// pool-enabled group" (broad cast). The threshold for non_predictors lets
// the admin target users with <= N predictions in a group (default 0 =
// users who haven't done anything).
export type AudienceFilter =
  | { kind: 'all' }
  | { kind: 'group'; groupId: string }
  | { kind: 'non_payers'; groupId: string | null }
  | { kind: 'non_predictors'; groupId: string | null; threshold?: number }
  | { kind: 'non_payers_and_non_predictors'; groupId: string | null }

export type ResolvedAudience = {
  userIds: string[]
  totalCount: number
}

const TOTAL_CATEGORIES = 14

async function nonPayersInGroup(groupId: string): Promise<string[]> {
  // members del grupo que NO tienen una poolTransactions row como
  // contributorUserId. LEFT JOIN + IS NULL es la forma más limpia.
  const rows = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .leftJoin(
      poolTransactions,
      and(
        eq(poolTransactions.groupId, groupMembers.groupId),
        eq(poolTransactions.contributorUserId, groupMembers.userId),
      ),
    )
    .where(and(eq(groupMembers.groupId, groupId), isNull(poolTransactions.id)))
  return rows.map((r) => r.userId)
}

async function nonPredictorsInGroup(groupId: string, threshold: number): Promise<string[]> {
  // members del grupo cuyo COUNT de predicciones <= threshold.
  const rows = await db
    .select({
      userId: groupMembers.userId,
      n: sql<number>`COUNT(${predictions.id})::int`,
    })
    .from(groupMembers)
    .leftJoin(
      predictions,
      and(
        eq(predictions.groupId, groupMembers.groupId),
        eq(predictions.userId, groupMembers.userId),
      ),
    )
    .where(eq(groupMembers.groupId, groupId))
    .groupBy(groupMembers.userId)
  return rows.filter((r) => r.n <= threshold).map((r) => r.userId)
}

async function poolEnabledGroupIds(): Promise<string[]> {
  const rows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.poolEnabled, true))
  return rows.map((r) => r.id)
}

async function activeGroupIds(): Promise<string[]> {
  // grupos cuyo lock aún no pasó (relevantes para empujar acción)
  const rows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(lt(sql`NOW()`, groups.predictionsLockAt))
  return rows.map((r) => r.id)
}

export async function resolveAudience(filter: AudienceFilter): Promise<ResolvedAudience> {
  switch (filter.kind) {
    case 'all': {
      // No baneados.
      const rows = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(isNull(profiles.bannedAt))
      const userIds = rows.map((r) => r.id)
      return { userIds, totalCount: userIds.length }
    }
    case 'group': {
      const rows = await db
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, filter.groupId))
      const userIds = rows.map((r) => r.userId)
      return { userIds, totalCount: userIds.length }
    }
    case 'non_payers': {
      const groupIds = filter.groupId
        ? [filter.groupId]
        : await intersect(await poolEnabledGroupIds(), await activeGroupIds())
      const set = new Set<string>()
      for (const gid of groupIds) {
        const ids = await nonPayersInGroup(gid)
        ids.forEach((id) => set.add(id))
      }
      const userIds = [...set]
      return { userIds, totalCount: userIds.length }
    }
    case 'non_predictors': {
      const threshold = filter.threshold ?? 0
      const groupIds = filter.groupId ? [filter.groupId] : await activeGroupIds()
      const set = new Set<string>()
      for (const gid of groupIds) {
        const ids = await nonPredictorsInGroup(gid, threshold)
        ids.forEach((id) => set.add(id))
      }
      const userIds = [...set]
      return { userIds, totalCount: userIds.length }
    }
    case 'non_payers_and_non_predictors': {
      const groupIds = filter.groupId
        ? [filter.groupId]
        : await intersect(await poolEnabledGroupIds(), await activeGroupIds())
      const set = new Set<string>()
      for (const gid of groupIds) {
        const payers = new Set(await nonPayersInGroup(gid))
        const predictors = new Set(await nonPredictorsInGroup(gid, TOTAL_CATEGORIES - 1))
        // Intersección: users que están en ambos sets para este grupo.
        for (const id of payers) if (predictors.has(id)) set.add(id)
      }
      const userIds = [...set]
      return { userIds, totalCount: userIds.length }
    }
  }
}

function intersect<T>(a: T[], b: T[]): T[] {
  const bset = new Set(b)
  return a.filter((x) => bset.has(x))
}

// Pretty-prints an AudienceFilter for the historial UI. Pure function, no
// DB. The page passes a map of groupId → groupName to make the labels
// human-readable.
export function describeAudience(
  filter: unknown,
  groupNames: Map<string, string>,
): string {
  if (!filter || typeof filter !== 'object' || !('kind' in filter)) return 'Desconocido'
  const f = filter as AudienceFilter
  switch (f.kind) {
    case 'all':
      return 'Todos los usuarios'
    case 'group':
      return `Miembros de ${groupNames.get(f.groupId) ?? f.groupId}`
    case 'non_payers':
      return f.groupId
        ? `Pendientes de pago en ${groupNames.get(f.groupId) ?? f.groupId}`
        : 'Pendientes de pago en cualquier grupo con pozo'
    case 'non_predictors':
      return f.groupId
        ? `Pendientes de predicción en ${groupNames.get(f.groupId) ?? f.groupId}`
        : 'Pendientes de predicción en cualquier grupo'
    case 'non_payers_and_non_predictors':
      return f.groupId
        ? `Sin pagar y sin predecir en ${groupNames.get(f.groupId) ?? f.groupId}`
        : 'Sin pagar y sin predecir en cualquier grupo'
  }
}
