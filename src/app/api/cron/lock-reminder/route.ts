import { and, eq, gt, lte, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { groupMembers, groups, predictions } from '@/db/schema'
import { env } from '@/lib/env'
import { sendNotificationByType } from '@/server/notifications/send'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
// Co-located with Supabase (us-west-2). See cron/resolve/route.ts.
export const preferredRegion = 'sfo1'

function isAuthorized(req: Request): boolean {
  const secret = env.CRON_SECRET ?? env.RESOLUTION_CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization')
  return header === `Bearer ${secret}`
}

const TOTAL_CATEGORIES = 14

// Hobby plan allows only daily crons, so we widen the windows to make sure
// each group gets its reminder once. Cron runs at 10:00 UTC.
type Window = { label: 'three_days' | 'tomorrow' | 'just_locked'; fromMs: number; toMs: number }

function nextWindows(now: number): Window[] {
  return [
    // Lock falls between now+58h and now+82h → "your lock is in 3 days".
    // Extra heads-up before the 24h window so users que entran poco se
    // enteren a tiempo de completar sus picks.
    { label: 'three_days', fromMs: now + 58 * 60 * 60 * 1000, toMs: now + 82 * 60 * 60 * 1000 },
    // Lock falls between now+10h and now+34h → "your lock is tomorrow-ish".
    { label: 'tomorrow', fromMs: now + 10 * 60 * 60 * 1000, toMs: now + 34 * 60 * 60 * 1000 },
    // Lock happened in the last 24h → "predictions are now locked".
    { label: 'just_locked', fromMs: now - 24 * 60 * 60 * 1000, toMs: now },
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
      .where(and(gt(groups.predictionsLockAt, from), lte(groups.predictionsLockAt, to)))

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
        await sendNotificationByType('lock_closed', userIds, {
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
        window.label === 'three_days'
          ? {
              title: '📅 Tus predicciones cierran en 3 días',
              body: `Todavía tienes margen para "${g.name}" — entra y deja tus 14 picks tranquilo.`,
            }
          : {
              title: '⏰ Tu lock está cerca',
              body: `No olvides cerrar tus picks de "${g.name}" antes del cierre.`,
            }

      await sendNotificationByType('lock_reminder', pendingUsers, {
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
