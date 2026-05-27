import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { groups, poolTransactions, profiles } from '@/db/schema'
import { getLeaderboard } from '@/features/scoring/queries'

export type PoolSummary = {
  enabled: boolean
  currency: string | null
  qrUrl: string | null
  payoutRule: 'winner_takes_all' | 'top_3_split' | 'manual'
  total: number
  transactionCount: number
}

export async function getPoolSummary(groupId: string): Promise<PoolSummary> {
  const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) })
  if (!group) {
    return {
      enabled: false,
      currency: null,
      qrUrl: null,
      payoutRule: 'winner_takes_all',
      total: 0,
      transactionCount: 0,
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
    enabled: group.poolEnabled,
    currency: group.poolCurrency,
    qrUrl: group.poolQrUrl,
    payoutRule: group.poolPayoutRule,
    total: Number(agg?.total ?? 0),
    transactionCount: agg?.count ?? 0,
  }
}

export type PoolTransactionRow = {
  id: string
  amount: number
  currency: string
  note: string | null
  contributorLabel: string
  createdAt: Date
  createdByUserId: string
}

export async function listPoolTransactions(groupId: string): Promise<PoolTransactionRow[]> {
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
    .where(eq(poolTransactions.groupId, groupId))
    .orderBy(desc(poolTransactions.createdAt))

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
  const leaderboard = await getLeaderboard(groupId)
  if (leaderboard.length === 0) return []

  const splits: Record<PoolSummary['payoutRule'], number[]> = {
    winner_takes_all: [1],
    top_3_split: [0.6, 0.3, 0.1],
    manual: [],
  }
  const percents = splits[summary.payoutRule]
  if (percents.length === 0) return []

  // Group by points using competition ranking: tied players share a rank and
  // split their slice proportionally; the next distinct group's rank skips by
  // the size of the tie (1, 1, 3, 3, 5).
  const groups: { rank: number; points: number; users: typeof leaderboard }[] = []
  let position = 1
  for (const row of leaderboard) {
    const last = groups.at(-1)
    if (last && last.points === row.totalPoints) {
      last.users.push(row)
    } else {
      groups.push({ rank: position, points: row.totalPoints, users: [row] })
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
