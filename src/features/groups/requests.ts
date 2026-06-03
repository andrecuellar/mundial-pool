'use server'

import { track } from '@vercel/analytics/server'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { groupCreationRequests, profiles } from '@/db/schema'
import { getSuperAdminUserIds, isSuperAdminEmail, requireSuperAdmin } from '@/lib/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendNotificationByType } from '@/server/notifications/send'

export type RequestActionResult = { ok: true } | { ok: false; error: string }

const requestSchema = z.object({
  message: z.string().max(500).optional().nullable(),
})

const reviewSchema = z.object({
  requestId: z.uuid(),
  reason: z.string().max(500).optional().nullable(),
})

async function requireUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function requestGroupCreation(input: unknown): Promise<RequestActionResult> {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Mensaje inválido (máximo 500 caracteres).' }

  const user = await requireUser()
  if (!user) return { ok: false, error: 'Necesitas estar autenticado.' }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { canCreateGroups: true, displayName: true, email: true },
  })
  if (!profile) return { ok: false, error: 'Perfil no encontrado.' }
  if (profile.canCreateGroups || isSuperAdminEmail(profile.email)) {
    return { ok: false, error: 'Ya tienes permiso para crear grupos.' }
  }

  // The partial unique index `uniq_gcr_pending_per_user` enforces this at the
  // DB level, but we check ahead of time for a friendly message.
  const existingPending = await db.query.groupCreationRequests.findFirst({
    where: and(
      eq(groupCreationRequests.userId, user.id),
      eq(groupCreationRequests.status, 'pending'),
    ),
    columns: { id: true },
  })
  if (existingPending) {
    return { ok: false, error: 'Ya tienes una solicitud pendiente. Espera la respuesta del admin.' }
  }

  const message = parsed.data.message?.trim() || null
  const [inserted] = await db
    .insert(groupCreationRequests)
    .values({ userId: user.id, message })
    .returning({ id: groupCreationRequests.id })

  revalidatePath('/')
  revalidatePath('/admin/solicitudes')

  after(async () => {
    try {
      const adminIds = await getSuperAdminUserIds()
      if (adminIds.length > 0) {
        await sendNotificationByType('group_creation_requested', adminIds, {
          title: `📝 ${profile.displayName} pide permiso para crear grupos`,
          body: message ?? '(sin mensaje)',
          url: '/admin/solicitudes',
          tag: `gcr-${inserted.id}`,
        })
      }
    } catch (e) {
      console.error('group_creation_requested notification failed', e)
    }
    try {
      await track('group_creation_requested')
    } catch (e) {
      console.error('analytics group_creation_requested failed', e)
    }
  })

  return { ok: true }
}

export async function approveGroupCreationRequest(input: unknown): Promise<RequestActionResult> {
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Solicitud inválida.' }

  const admin = await requireSuperAdmin()

  const request = await db.query.groupCreationRequests.findFirst({
    where: eq(groupCreationRequests.id, parsed.data.requestId),
    columns: { id: true, userId: true, status: true },
  })
  if (!request) return { ok: false, error: 'Solicitud no encontrada.' }
  if (request.status !== 'pending') {
    return { ok: false, error: 'Esta solicitud ya fue revisada.' }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(groupCreationRequests)
      .set({
        status: 'approved',
        reviewedByUserId: admin.id,
        reviewedAt: new Date(),
      })
      .where(eq(groupCreationRequests.id, request.id))
    await tx
      .update(profiles)
      .set({ canCreateGroups: true })
      .where(eq(profiles.id, request.userId))
  })

  revalidatePath('/admin/solicitudes')
  revalidatePath('/')

  after(async () => {
    try {
      await sendNotificationByType('group_creation_approved', [request.userId], {
        title: '✅ Te aprobaron para crear grupos',
        body: 'Ya puedes crear tus grupos en mundial-pool.',
        url: '/groups/new',
        tag: `gcr-approved-${request.id}`,
      })
    } catch (e) {
      console.error('group_creation_approved notification failed', e)
    }
    try {
      await track('group_creation_approved')
    } catch (e) {
      console.error('analytics group_creation_approved failed', e)
    }
  })

  return { ok: true }
}

export async function rejectGroupCreationRequest(input: unknown): Promise<RequestActionResult> {
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Solicitud inválida.' }

  const admin = await requireSuperAdmin()

  const request = await db.query.groupCreationRequests.findFirst({
    where: eq(groupCreationRequests.id, parsed.data.requestId),
    columns: { id: true, userId: true, status: true },
  })
  if (!request) return { ok: false, error: 'Solicitud no encontrada.' }
  if (request.status !== 'pending') {
    return { ok: false, error: 'Esta solicitud ya fue revisada.' }
  }

  const reason = parsed.data.reason?.trim() || null

  await db
    .update(groupCreationRequests)
    .set({
      status: 'rejected',
      reviewedByUserId: admin.id,
      reviewedAt: new Date(),
      rejectionReason: reason,
    })
    .where(eq(groupCreationRequests.id, request.id))

  revalidatePath('/admin/solicitudes')
  revalidatePath('/')

  after(async () => {
    try {
      await sendNotificationByType('group_creation_rejected', [request.userId], {
        title: '🚫 Tu solicitud de crear grupo fue rechazada',
        body: reason ? `Motivo: ${reason}` : 'Puedes pedir permiso de nuevo más adelante.',
        url: '/',
        tag: `gcr-rejected-${request.id}`,
      })
    } catch (e) {
      console.error('group_creation_rejected notification failed', e)
    }
    try {
      await track('group_creation_rejected', { hasReason: reason !== null })
    } catch (e) {
      console.error('analytics group_creation_rejected failed', e)
    }
  })

  return { ok: true }
}
