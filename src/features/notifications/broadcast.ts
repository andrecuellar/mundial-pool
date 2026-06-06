'use server'

import { track } from '@vercel/analytics/server'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { adminBroadcasts } from '@/db/schema'
import { isSuperAdmin } from '@/lib/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendNotificationByType, sendPushToUsers } from '@/server/notifications/send'
import { type AudienceFilter, resolveAudience } from './audience'

const filterSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('group'), groupId: z.uuid() }),
  z.object({ kind: z.literal('non_payers'), groupId: z.uuid().nullable() }),
  z.object({
    kind: z.literal('non_predictors'),
    groupId: z.uuid().nullable(),
    threshold: z.number().int().min(0).max(14).optional(),
  }),
  z.object({
    kind: z.literal('non_payers_and_non_predictors'),
    groupId: z.uuid().nullable(),
  }),
])

const sendSchema = z.object({
  title: z.string().min(1).max(60),
  body: z.string().min(1).max(200),
  url: z.string().max(500).optional().nullable(),
  audienceFilter: filterSchema,
  ignoreOptOut: z.boolean(),
})

export async function previewAudience(
  input: unknown,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const parsed = filterSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Filtro inválido.' }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isSuperAdmin(user)) return { ok: false, error: 'No autorizado.' }

  const resolved = await resolveAudience(parsed.data)
  return { ok: true, count: resolved.totalCount }
}

export async function sendAdminBroadcast(
  input: unknown,
): Promise<
  | { ok: true; broadcastId: string; audienceCount: number }
  | { ok: false; error: string }
> {
  const parsed = sendSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos.' }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isSuperAdmin(user) || !user) return { ok: false, error: 'No autorizado.' }

  const filter = parsed.data.audienceFilter as AudienceFilter
  const audience = await resolveAudience(filter)

  const [inserted] = await db
    .insert(adminBroadcasts)
    .values({
      sentByUserId: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      url: parsed.data.url ?? null,
      audienceFilter: filter,
      audienceCount: audience.totalCount,
      deliveredCount: 0,
      ignoreOptOut: parsed.data.ignoreOptOut,
    })
    .returning({ id: adminBroadcasts.id })

  const broadcastId = inserted.id

  // Hacemos el envío real en background — la response al admin sale en ms.
  // El sender es secuencial; para audiencias grandes puede tardar un rato.
  after(async () => {
    const payload = {
      title: parsed.data.title,
      body: parsed.data.body,
      url: parsed.data.url ?? '/',
      tag: `broadcast-${broadcastId}`,
    }
    try {
      const result = parsed.data.ignoreOptOut
        ? await sendPushToUsers(audience.userIds, payload)
        : await sendNotificationByType('admin_broadcast', audience.userIds, payload)
      await db
        .update(adminBroadcasts)
        .set({ deliveredCount: result.sent })
        .where(eq(adminBroadcasts.id, broadcastId))
      await track('admin_broadcast_sent', {
        audienceKind: filter.kind,
        audienceCount: audience.totalCount,
        delivered: result.sent,
        failed: result.failed,
        ignoreOptOut: parsed.data.ignoreOptOut,
      }).catch(() => {})
    } catch (e) {
      console.error('admin broadcast send failed', e)
    }
  })

  revalidatePath('/admin/notificar')
  return { ok: true, broadcastId, audienceCount: audience.totalCount }
}
