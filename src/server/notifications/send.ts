import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import webpush from 'web-push'
import { db } from '@/db'
import { notificationPreferences, pushSubscriptions } from '@/db/schema'
import { env } from '@/lib/env'
import type { NotificationType } from './types'

let configured = false

function configure(): boolean {
  if (configured) return true
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return false
  }
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  )
  configured = true
  return true
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

async function sendToSubscription(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
) {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    )
    return true
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) {
      // Subscription expired — clean up.
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id))
    }
    console.error('webpush.send failed', status, (e as Error).message)
    return false
  }
}

// Low-level: send to every subscription belonging to the listed users without
// consulting preferences. Used internally + by sendNotificationByType. Direct
// callers should prefer the high-level helper so user opt-outs are honored.
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!configure() || userIds.length === 0) return { sent: 0, failed: 0 }
  const subs = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds))
  let sent = 0
  let failed = 0
  for (const sub of subs) {
    const ok = await sendToSubscription(sub, payload)
    if (ok) sent++
    else failed++
  }
  return { sent, failed }
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  return sendPushToUsers([userId], payload)
}

// High-level: filter out users that opted out of this specific type, then
// send. Absence of a row in notification_preferences is interpreted as
// enabled = true (default), so we only need to query rows where enabled =
// false to know who to skip.
export async function sendNotificationByType(
  type: NotificationType,
  userIds: string[],
  payload: PushPayload,
) {
  if (userIds.length === 0) return { sent: 0, failed: 0 }
  const disabled = await db
    .select({ userId: notificationPreferences.userId })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.type, type),
        eq(notificationPreferences.enabled, false),
        inArray(notificationPreferences.userId, userIds),
      ),
    )
  const disabledSet = new Set(disabled.map((d) => d.userId))
  const allowed = userIds.filter((id) => !disabledSet.has(id))
  return sendPushToUsers(allowed, payload)
}
