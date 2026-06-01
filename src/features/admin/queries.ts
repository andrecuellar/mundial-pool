import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  appState,
  categories,
  groupCategories,
  groupMembers,
  groups,
  players,
  poolTransactions,
  predictions,
  profiles,
  resolutionRuns,
  results,
  teams,
} from '@/db/schema'

export async function getAdminDashboardSummary() {
  const [
    [userCount],
    [groupCount],
    [predictionCount],
    [transactionAgg],
    transactionByCurrency,
    [lastResolution],
    recentSignups,
    recentGroups,
    recentTransactions,
  ] = await Promise.all([
    db.select({ count: count() }).from(profiles),
    db.select({ count: count() }).from(groups),
    db.select({ count: count() }).from(predictions),
    db.select({ count: count() }).from(poolTransactions),
    db
      .select({
        currency: poolTransactions.currency,
        total: sql<string>`COALESCE(SUM(${poolTransactions.amount}), 0)`,
      })
      .from(poolTransactions)
      .groupBy(poolTransactions.currency),
    db
      .select({
        startedAt: resolutionRuns.startedAt,
        finishedAt: resolutionRuns.finishedAt,
        status: resolutionRuns.status,
      })
      .from(resolutionRuns)
      .orderBy(desc(resolutionRuns.startedAt))
      .limit(1),
    db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        email: profiles.email,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .orderBy(desc(profiles.createdAt))
      .limit(10),
    db
      .select({
        id: groups.id,
        slug: groups.slug,
        name: groups.name,
        createdAt: groups.createdAt,
      })
      .from(groups)
      .orderBy(desc(groups.createdAt))
      .limit(10),
    db
      .select({
        id: poolTransactions.id,
        groupName: groups.name,
        groupSlug: groups.slug,
        contributorLabel: poolTransactions.contributorLabel,
        contributorName: profiles.displayName,
        amount: poolTransactions.amount,
        currency: poolTransactions.currency,
        createdAt: poolTransactions.createdAt,
      })
      .from(poolTransactions)
      .innerJoin(groups, eq(groups.id, poolTransactions.groupId))
      .leftJoin(profiles, eq(profiles.id, poolTransactions.contributorUserId))
      .orderBy(desc(poolTransactions.createdAt))
      .limit(10),
  ])

  return {
    counts: {
      users: userCount.count,
      groups: groupCount.count,
      predictions: predictionCount.count,
      transactions: transactionAgg.count,
    },
    poolTotals: transactionByCurrency.map((r) => ({
      currency: r.currency,
      total: Number(r.total),
    })),
    lastResolution: lastResolution ?? null,
    recentSignups,
    recentGroups,
    recentTransactions: recentTransactions.map((r) => ({
      ...r,
      amount: Number(r.amount),
      contributorLabel: r.contributorName ?? r.contributorLabel ?? 'Anónimo',
    })),
  }
}

export async function listAdminUsers() {
  const groupCounts = db
    .select({
      userId: groupMembers.userId,
      groupCount: count().as('group_count'),
    })
    .from(groupMembers)
    .groupBy(groupMembers.userId)
    .as('gc')

  const predictionCounts = db
    .select({
      userId: predictions.userId,
      predictionCount: count().as('prediction_count'),
    })
    .from(predictions)
    .groupBy(predictions.userId)
    .as('pc')

  const rows = await db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
      email: profiles.email,
      avatarUrl: profiles.avatarUrl,
      createdAt: profiles.createdAt,
      bannedAt: profiles.bannedAt,
      groupCount: groupCounts.groupCount,
      predictionCount: predictionCounts.predictionCount,
    })
    .from(profiles)
    .leftJoin(groupCounts, eq(groupCounts.userId, profiles.id))
    .leftJoin(predictionCounts, eq(predictionCounts.userId, profiles.id))
    .orderBy(desc(profiles.createdAt))

  return rows.map((r) => ({
    ...r,
    groupCount: r.groupCount ?? 0,
    predictionCount: r.predictionCount ?? 0,
  }))
}

export async function getAdminUserDetail(userId: string) {
  const [profile, memberships, predictionRows, contributedTx] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.id, userId) }),
    db
      .select({
        groupId: groupMembers.groupId,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
        groupName: groups.name,
        groupSlug: groups.slug,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, userId))
      .orderBy(desc(groupMembers.joinedAt)),
    db
      .select({
        groupName: groups.name,
        groupSlug: groups.slug,
        categoryKey: categories.key,
        categoryName: categories.name,
        teamName: teams.name,
        playerText: predictions.playerText,
        teamSet: predictions.teamSet,
        updatedAt: predictions.updatedAt,
      })
      .from(predictions)
      .innerJoin(groups, eq(groups.id, predictions.groupId))
      .innerJoin(categories, eq(categories.id, predictions.categoryId))
      .leftJoin(teams, eq(teams.id, predictions.teamId))
      .where(eq(predictions.userId, userId))
      .orderBy(desc(predictions.updatedAt)),
    db
      .select({
        id: poolTransactions.id,
        groupName: groups.name,
        groupSlug: groups.slug,
        amount: poolTransactions.amount,
        currency: poolTransactions.currency,
        note: poolTransactions.note,
        createdAt: poolTransactions.createdAt,
      })
      .from(poolTransactions)
      .innerJoin(groups, eq(groups.id, poolTransactions.groupId))
      .where(eq(poolTransactions.contributorUserId, userId))
      .orderBy(desc(poolTransactions.createdAt)),
  ])

  return {
    profile: profile ?? null,
    memberships,
    predictions: predictionRows,
    contributedTransactions: contributedTx.map((r) => ({ ...r, amount: Number(r.amount) })),
  }
}

export async function listAdminGroups() {
  const memberCounts = db
    .select({
      groupId: groupMembers.groupId,
      memberCount: count().as('member_count'),
    })
    .from(groupMembers)
    .groupBy(groupMembers.groupId)
    .as('mc')

  const fullCompletions = db
    .select({
      groupId: predictions.groupId,
      userId: predictions.userId,
      filled: count().as('filled'),
    })
    .from(predictions)
    .groupBy(predictions.groupId, predictions.userId)
    .as('uc')

  const groupCompletions = db
    .select({
      groupId: fullCompletions.groupId,
      completedMembers:
        sql<number>`SUM(CASE WHEN ${fullCompletions.filled} >= 14 THEN 1 ELSE 0 END)`.as(
          'completed_members',
        ),
    })
    .from(fullCompletions)
    .groupBy(fullCompletions.groupId)
    .as('gc')

  const poolAggs = db
    .select({
      groupId: poolTransactions.groupId,
      txCount: count().as('tx_count'),
      total: sql<string>`COALESCE(SUM(${poolTransactions.amount}), 0)`.as('pool_total'),
    })
    .from(poolTransactions)
    .groupBy(poolTransactions.groupId)
    .as('pa')

  const rows = await db
    .select({
      id: groups.id,
      slug: groups.slug,
      name: groups.name,
      createdBy: groups.createdBy,
      ownerName: profiles.displayName,
      predictionsLockAt: groups.predictionsLockAt,
      poolEnabled: groups.poolEnabled,
      poolCurrency: groups.poolCurrency,
      memberCount: memberCounts.memberCount,
      completedMembers: groupCompletions.completedMembers,
      txCount: poolAggs.txCount,
      poolTotal: poolAggs.total,
      createdAt: groups.createdAt,
    })
    .from(groups)
    .innerJoin(profiles, eq(profiles.id, groups.createdBy))
    .leftJoin(memberCounts, eq(memberCounts.groupId, groups.id))
    .leftJoin(groupCompletions, eq(groupCompletions.groupId, groups.id))
    .leftJoin(poolAggs, eq(poolAggs.groupId, groups.id))
    .orderBy(desc(groups.createdAt))

  return rows.map((r) => ({
    ...r,
    memberCount: r.memberCount ?? 0,
    completedMembers: Number(r.completedMembers ?? 0),
    txCount: r.txCount ?? 0,
    poolTotal: Number(r.poolTotal ?? 0),
  }))
}

export async function getAdminGroupDetail(slug: string) {
  const group = await db.query.groups.findFirst({ where: eq(groups.slug, slug) })
  if (!group) return null

  const [members, txRows, groupCats] = await Promise.all([
    db
      .select({
        userId: groupMembers.userId,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
        displayName: profiles.displayName,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
      })
      .from(groupMembers)
      .innerJoin(profiles, eq(profiles.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, group.id))
      .orderBy(groupMembers.joinedAt),
    db
      .select({
        id: poolTransactions.id,
        amount: poolTransactions.amount,
        currency: poolTransactions.currency,
        note: poolTransactions.note,
        contributorLabel: poolTransactions.contributorLabel,
        contributorName: profiles.displayName,
        registeredByName: sql<string>`(SELECT display_name FROM profiles WHERE id = ${poolTransactions.createdByUserId})`,
        createdAt: poolTransactions.createdAt,
      })
      .from(poolTransactions)
      .leftJoin(profiles, eq(profiles.id, poolTransactions.contributorUserId))
      .where(eq(poolTransactions.groupId, group.id))
      .orderBy(desc(poolTransactions.createdAt)),
    db
      .select({
        key: categories.key,
        name: categories.name,
        valueKind: categories.valueKind,
        defaultPoints: categories.defaultPoints,
        points: groupCategories.points,
        enabled: groupCategories.enabled,
      })
      .from(groupCategories)
      .innerJoin(categories, eq(categories.id, groupCategories.categoryId))
      .where(eq(groupCategories.groupId, group.id)),
  ])

  return {
    group,
    members,
    transactions: txRows.map((r) => ({
      ...r,
      amount: Number(r.amount),
      contributorLabel: r.contributorName ?? r.contributorLabel ?? 'Anónimo',
    })),
    categories: groupCats,
  }
}

export async function listAdminPredictions(filters?: { categoryKey?: string; groupSlug?: string }) {
  const conditions = []
  if (filters?.categoryKey) conditions.push(eq(categories.key, filters.categoryKey))
  if (filters?.groupSlug) conditions.push(eq(groups.slug, filters.groupSlug))

  const rows = await db
    .select({
      id: predictions.id,
      groupName: groups.name,
      groupSlug: groups.slug,
      userName: profiles.displayName,
      userId: predictions.userId,
      categoryKey: categories.key,
      categoryName: categories.name,
      teamName: teams.name,
      teamFlag: teams.flagEmoji,
      teamSet: predictions.teamSet,
      playerText: predictions.playerText,
      updatedAt: predictions.updatedAt,
    })
    .from(predictions)
    .innerJoin(groups, eq(groups.id, predictions.groupId))
    .innerJoin(profiles, eq(profiles.id, predictions.userId))
    .innerJoin(categories, eq(categories.id, predictions.categoryId))
    .leftJoin(teams, eq(teams.id, predictions.teamId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(predictions.updatedAt))
    .limit(500)

  return rows
}

export async function listAdminPoolTransactions() {
  const rows = await db
    .select({
      id: poolTransactions.id,
      groupName: groups.name,
      groupSlug: groups.slug,
      groupQrUrl: groups.poolQrUrl,
      contributorLabel: poolTransactions.contributorLabel,
      contributorName: profiles.displayName,
      amount: poolTransactions.amount,
      currency: poolTransactions.currency,
      note: poolTransactions.note,
      registeredByName: sql<string>`(SELECT display_name FROM profiles WHERE id = ${poolTransactions.createdByUserId})`,
      createdAt: poolTransactions.createdAt,
    })
    .from(poolTransactions)
    .innerJoin(groups, eq(groups.id, poolTransactions.groupId))
    .leftJoin(profiles, eq(profiles.id, poolTransactions.contributorUserId))
    .orderBy(desc(poolTransactions.createdAt))

  return rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    contributorLabel: r.contributorName ?? r.contributorLabel ?? 'Anónimo',
  }))
}

export async function listAdminQrUploads() {
  const rows = await db
    .select({
      slug: groups.slug,
      name: groups.name,
      qrUrl: groups.poolQrUrl,
      currency: groups.poolCurrency,
    })
    .from(groups)
    .where(sql`${groups.poolQrUrl} IS NOT NULL`)
    .orderBy(groups.name)
  return rows
}

export async function listAdminCategories() {
  return db.select().from(categories).orderBy(categories.name)
}

export async function listAdminTeams() {
  return db.select().from(teams).orderBy(sql`COALESCE(${teams.fifaRanking}, 999), ${teams.name}`)
}

export async function listAdminPlayers() {
  return db
    .select({
      id: players.id,
      fullName: players.fullName,
      position: players.position,
      dateOfBirth: players.dateOfBirth,
      teamName: teams.name,
      teamFlag: teams.flagEmoji,
    })
    .from(players)
    .leftJoin(teams, eq(teams.id, players.teamId))
    .orderBy(players.fullName)
}

export async function listAdminResults() {
  return db
    .select({
      categoryKey: categories.key,
      categoryName: categories.name,
      teamName: teams.name,
      teamSet: results.teamSet,
      playerText: results.playerText,
      source: results.source,
      resolvedAt: results.resolvedAt,
    })
    .from(results)
    .innerJoin(categories, eq(categories.id, results.categoryId))
    .leftJoin(teams, eq(teams.id, results.teamId))
    .orderBy(results.resolvedAt)
}

export async function listAdminResolutionRuns() {
  return db.select().from(resolutionRuns).orderBy(desc(resolutionRuns.startedAt)).limit(50)
}

export async function listAdminAppState() {
  return db.select().from(appState).orderBy(appState.key)
}
