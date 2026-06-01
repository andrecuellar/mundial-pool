import { and, eq, gt, lte, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { groupMembers, groups, predictions } from '@/db/schema'
import { env } from '@/lib/env'
import { sendPushToUsers } from '@/server/push'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function isAuthorized(req: Request): boolean {
  const secret = env.CRON_SECRET ?? env.RESOLUTION_CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization')
  return header === `Bearer ${secret}`
}

const TOTAL_CATEGORIES = 14

type Window = { label: '24h' | '1h' | 'just_locked'; fromMs: number; toMs: number }

function nextWindows(now: number): Window[] {
  return [
    { label: '24h', fromMs: now + 23 * 60 * 60 * 1000, toMs: now + 25 * 60 * 60 * 1000 },
    { label: '1h', fromMs: now + 30 * 60 * 1000, toMs: now + 70 * 60 * 1000 },
    { label: 'just_locked', fromMs: now - 70 * 60 * 1000, toMs: now - 30 * 60 * 1000 },
  ]
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const summary: Record<string, { groups: number; usersNotified: number }> = {}

  for (const window of nextWindows(now)) {
    const from = new Date(window.fromMs)
    const to = new Date(window.toMs)
    const dueGroups = await db
      .select({ id: groups.id, name: groups.name, slug: groups.slug })
      .from(groups)
      .where(
        and(gt(groups.predictionsLockAt, from), lte(groups.predictionsLockAt, to)),
      )

    let usersTotal = 0

    for (const g of dueGroups) {
      if (window.label === 'just_locked') {
        // Notify ALL members.
        const members = await db
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(eq(groupMembers.groupId, g.id))
        const userIds = members.map((m) => m.userId)
        if (userIds.length === 0) continue
        await sendPushToUsers(userIds, {
          title: '🔒 Predicciones bloqueadas',
          body: `Las apuestas de "${g.name}" están cerradas. ¡Que empiece el Mundial!`,
          url: `/groups/${g.slug}`,
          tag: `lock-closed-${g.id}`,
        })
        usersTotal += userIds.length
        continue
      }

      // For 24h and 1h: notify only members with incomplete picks.
      const completed = await db
        .select({
          userId: predictions.userId,
          filled: sql<number>`COUNT(*)`.as('filled'),
        })
        .from(predictions)
        .where(eq(predictions.groupId, g.id))
        .groupBy(predictions.userId)

      const completedUsers = new Set(
        completed.filter((r) => Number(r.filled) >= TOTAL_CATEGORIES).map((r) => r.userId),
      )

      const allMembers = await db
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, g.id))
      const pendingUsers = allMembers.map((m) => m.userId).filter((id) => !completedUsers.has(id))
      if (pendingUsers.length === 0) continue

      const copy =
        window.label === '24h'
          ? {
              title: '⏰ Te queda 1 día',
              body: `No olvides cerrar tus picks de "${g.name}" antes del cierre.`,
            }
          : {
              title: '🚨 Última hora',
              body: `Tus predicciones de "${g.name}" cierran en menos de 1 hora.`,
            }

      await sendPushToUsers(pendingUsers, {
        title: copy.title,
        body: copy.body,
        url: `/groups/${g.slug}/predict`,
        tag: `lock-reminder-${window.label}-${g.id}`,
      })
      usersTotal += pendingUsers.length
    }

    summary[window.label] = { groups: dueGroups.length, usersNotified: usersTotal }
  }

  return NextResponse.json({ ok: true, summary })
}

export const GET = handle
export const POST = handle
