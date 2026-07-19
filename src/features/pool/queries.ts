import { and, desc, eq, isNotNull, lt, sql } from 'drizzle-orm'
import { cache } from 'react'
import { db } from '@/db'
import { groups, poolTransactions, profiles } from '@/db/schema'
import { getRankedLeaderboard } from '@/features/scoring/queries'

export type PoolSummary = {
  enabled: boolean
  currency: string | null
  buyInAmount: number
  qrUrl: string | null
  payoutRule: 'winner_takes_all' | 'top_3_split' | 'manual'
  total: number
  transactionCount: number
  creatorDisplayName: string | null
  creatorEmail: string | null
}

// Wrapped in React cache so a single request that calls getPoolSummary from
// both the page's Promise.all and computePayout internally only runs the
// query once. Same below with getLeaderboard.
export const getPoolSummary = cache(async (groupId: string): Promise<PoolSummary> => {
  // Join the creator's profile so we can reveal who exactly is collecting the
  // money before a member scans the QR. This is the central trust signal for
  // "you're sending real cash to a real person, not to the app".
  const [row] = await db
    .select({
      poolEnabled: groups.poolEnabled,
      poolCurrency: groups.poolCurrency,
      poolBuyInAmount: groups.poolBuyInAmount,
      poolQrUrl: groups.poolQrUrl,
      poolPayoutRule: groups.poolPayoutRule,
      creatorDisplayName: profiles.displayName,
      creatorEmail: profiles.email,
    })
    .from(groups)
    .leftJoin(profiles, eq(profiles.id, groups.createdBy))
    .where(eq(groups.id, groupId))
    .limit(1)

  if (!row) {
    return {
      enabled: false,
      currency: null,
      buyInAmount: 100,
      qrUrl: null,
      payoutRule: 'winner_takes_all',
      total: 0,
      transactionCount: 0,
      creatorDisplayName: null,
      creatorEmail: null,
    }
  }
  const [agg] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${poolTransactions.amount}), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(poolTransactions)
    .where(eq(poolTransactions.groupId, groupId))

  return {
    enabled: row.poolEnabled,
    currency: row.poolCurrency,
    buyInAmount: Number(row.poolBuyInAmount),
    qrUrl: row.poolQrUrl,
    payoutRule: row.poolPayoutRule,
    total: Number(agg?.total ?? 0),
    transactionCount: agg?.count ?? 0,
    creatorDisplayName: row.creatorDisplayName,
    creatorEmail: row.creatorEmail,
  }
})

export type PoolTransactionRow = {
  id: string
  amount: number
  currency: string
  note: string | null
  contributorLabel: string
  createdAt: Date
  createdByUserId: string
}

export const POOL_LEDGER_PAGE_SIZE = 20

export async function listPoolTransactions(
  groupId: string,
  opts: { before?: Date; limit?: number } = {},
): Promise<PoolTransactionRow[]> {
  const limit = opts.limit ?? POOL_LEDGER_PAGE_SIZE
  const whereClause = opts.before
    ? and(eq(poolTransactions.groupId, groupId), lt(poolTransactions.createdAt, opts.before))
    : eq(poolTransactions.groupId, groupId)

  const rows = await db
    .select({
      id: poolTransactions.id,
      amount: poolTransactions.amount,
      currency: poolTransactions.currency,
      note: poolTransactions.note,
      contributorUserId: poolTransactions.contributorUserId,
      contributorLabel: poolTransactions.contributorLabel,
      contributorName: profiles.displayName,
      createdAt: poolTransactions.createdAt,
      createdByUserId: poolTransactions.createdByUserId,
    })
    .from(poolTransactions)
    .leftJoin(profiles, eq(profiles.id, poolTransactions.contributorUserId))
    .where(whereClause)
    .orderBy(desc(poolTransactions.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    currency: r.currency,
    note: r.note,
    contributorLabel: r.contributorName ?? r.contributorLabel ?? 'Anónimo',
    createdAt: r.createdAt,
    createdByUserId: r.createdByUserId,
  }))
}

// Set of user IDs in the group that have at least one pool contribution.
// Used by the leaderboard to show paid / pending badges next to each member.
export async function getPoolContributorIds(groupId: string): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ userId: poolTransactions.contributorUserId })
    .from(poolTransactions)
    .where(
      and(eq(poolTransactions.groupId, groupId), isNotNull(poolTransactions.contributorUserId)),
    )
  const out = new Set<string>()
  for (const r of rows) if (r.userId) out.add(r.userId)
  return out
}

// userId → fecha del primer aporte. Lo usa la tabla de líderes para mostrar
// "Pagó tarde" (rojo) cuando el primer pago fue posterior al cierre del grupo.
export type PaidEntry = { userId: string; paidAt: string }
export async function getPoolContributorPaidAt(groupId: string): Promise<PaidEntry[]> {
  const rows = await db
    .select({
      userId: poolTransactions.contributorUserId,
      firstAt: sql<string>`MIN(${poolTransactions.createdAt})`,
    })
    .from(poolTransactions)
    .where(
      and(eq(poolTransactions.groupId, groupId), isNotNull(poolTransactions.contributorUserId)),
    )
    .groupBy(poolTransactions.contributorUserId)
  const out: PaidEntry[] = []
  for (const r of rows) {
    if (r.userId && r.firstAt) {
      out.push({ userId: r.userId, paidAt: new Date(r.firstAt).toISOString() })
    }
  }
  return out
}

export type PayoutEntry = {
  rank: number
  tied: boolean
  userId: string
  displayName: string
  amount: number
  percent: number
}

export async function computePayout(groupId: string): Promise<PayoutEntry[]> {
  const summary = await getPoolSummary(groupId)
  if (!summary.enabled || summary.total === 0) return []
  // Los que NO aportaron al pozo no pueden ganar plata: se excluyen del reparto.
  // hasPaid===false = no-pagador explícito (undefined en snapshots viejos = elegible).
  const leaderboard = (await getRankedLeaderboard(groupId)).filter((r) => r.hasPaid !== false)
  if (leaderboard.length === 0) return []

  const splits: Record<PoolSummary['payoutRule'], number[]> = {
    winner_takes_all: [1],
    top_3_split: [0.6, 0.3, 0.1],
    manual: [],
  }
  const percents = splits[summary.payoutRule]
  if (percents.length === 0) return []

  // Group using competition ranking with the same tiebreak as the table: tied
  // on points AND definitive failures share a rank and split their slice
  // proportionally; the next distinct group's rank skips by the size of the
  // tie (1, 1, 3, 3, 5). Fewer failures on equal points = better rank.
  const groups: { rank: number; points: number; failed: number; users: typeof leaderboard }[] = []
  let position = 1
  for (const row of leaderboard) {
    const last = groups.at(-1)
    if (last && last.points === row.totalPoints && last.failed === row.failedCount) {
      last.users.push(row)
    } else {
      groups.push({
        rank: position,
        points: row.totalPoints,
        failed: row.failedCount,
        users: [row],
      })
    }
    position++
  }

  const eligibleGroups = groups.filter((g) => g.points > 0)

  const entries: PayoutEntry[] = []
  percents.slice(0, eligibleGroups.length).forEach((p, i) => {
    const g = eligibleGroups[i]
    const perUser = (summary.total * p) / g.users.length
    const tied = g.users.length > 1
    for (const u of g.users) {
      entries.push({
        rank: g.rank,
        tied,
        userId: u.userId,
        displayName: u.displayName,
        amount: Math.round(perUser * 100) / 100,
        percent: p / g.users.length,
      })
    }
  })

  return entries
}
