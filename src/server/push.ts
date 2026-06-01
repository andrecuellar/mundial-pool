import 'server-only'
import { eq, inArray } from 'drizzle-orm'
import webpush from 'web-push'
import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'
import { env } from '@/lib/env'

let configured = false

function configure(): boolean {
  if (configured) return true
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
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
