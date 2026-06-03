'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { notificationPreferences } from '@/db/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  NOTIFICATION_TYPE_KEYS,
  NOTIFICATION_TYPES,
  type NotificationType,
} from '@/server/notifications/types'

export type PreferencesResult =
  | { ok: true; preferences: Record<NotificationType, boolean> }
  | { ok: false; error: string }

export type ToggleResult = { ok: true } | { ok: false; error: string }

async function requireUserId(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }
  return { userId: user.id }
}

export async function getMyPreferences(): Promise<PreferencesResult> {
  const auth = await requireUserId()
  if ('error' in auth) return { ok: false, error: auth.error }
  const rows = await db
    .select({ type: notificationPreferences.type, enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, auth.userId))
  // Default true for every known type; flip to false for the rows that say so.
  // Unknown types (e.g. retired triggers) are ignored.
  const preferences = {} as Record<NotificationType, boolean>
  for (const t of NOTIFICATION_TYPES) preferences[t.key] = true
  for (const r of rows) {
    if (NOTIFICATION_TYPE_KEYS.has(r.type as NotificationType)) {
      preferences[r.type as NotificationType] = r.enabled
    }
  }
  return { ok: true, preferences }
}

export async function setPreference(type: string, enabled: boolean): Promise<ToggleResult> {
  if (!NOTIFICATION_TYPE_KEYS.has(type as NotificationType)) {
    return { ok: false, error: 'Tipo de notificación desconocido.' }
  }
  const auth = await requireUserId()
  if ('error' in auth) return { ok: false, error: auth.error }

  await db
    .insert(notificationPreferences)
    .values({ userId: auth.userId, type, enabled })
    .onConflictDoUpdate({
      target: [notificationPreferences.userId, notificationPreferences.type],
      set: { enabled },
    })

  revalidatePath('/settings/notifications')
  return { ok: true }
}
