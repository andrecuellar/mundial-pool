'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { isSuperAdminEmail, requireSuperAdmin } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { runResolution } from '@/server/resolution'

export type AdminActionResult = { ok: true } | { ok: false; error: string }

const banSchema = z.object({
  userId: z.uuid(),
  reason: z.string().max(500).nullable(),
})

export async function banUser(input: unknown): Promise<AdminActionResult> {
  const parsed = banSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos.' }

  const me = await requireSuperAdmin()

  const target = await db.query.profiles.findFirst({
    where: eq(profiles.id, parsed.data.userId),
    columns: { id: true, email: true },
  })
  if (!target) return { ok: false, error: 'Usuario no encontrado.' }

  // Defense in depth — superadmins cannot ban each other (or themselves).
  if (isSuperAdminEmail(target.email)) {
    return { ok: false, error: 'No se puede banear a un superadmin.' }
  }

  await db
    .update(profiles)
    .set({
      bannedAt: new Date(),
      bannedReason: parsed.data.reason,
      bannedByUserId: me.id,
    })
    .where(eq(profiles.id, parsed.data.userId))

  // Force the user out of any active session so the ban takes effect
  // immediately. Supabase's ban_duration invalidates their existing
  // refresh tokens. Best-effort — if the service-role key isn't
  // configured the ban still blocks the next login via the callback.
  try {
    const admin = createSupabaseAdminClient()
    await admin.auth.admin.updateUserById(parsed.data.userId, { ban_duration: '8760h' })
  } catch (e) {
    console.error('supabase ban failed', e)
  }

  revalidatePath('/admin/usuarios')
  revalidatePath(`/admin/usuarios/${parsed.data.userId}`)
  return { ok: true }
}

export async function unbanUser(userId: string): Promise<AdminActionResult> {
  await requireSuperAdmin()
  if (!z.uuid().safeParse(userId).success) {
    return { ok: false, error: 'ID inválido.' }
  }

  await db
    .update(profiles)
    .set({ bannedAt: null, bannedReason: null, bannedByUserId: null })
    .where(eq(profiles.id, userId))

  // Lift the matching Supabase ban so the user can log in again.
  try {
    const admin = createSupabaseAdminClient()
    await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
  } catch (e) {
    console.error('supabase unban failed', e)
  }

  revalidatePath('/admin/usuarios')
  revalidatePath(`/admin/usuarios/${userId}`)
  return { ok: true }
}

export type ForceResolutionResult = { ok: true; message: string } | { ok: false; error: string }

/**
 * Dispara la resolución del Mundial a mano (mismo runResolution() que el cron).
 * Pensado para forzar la resolución al instante en que termina un partido —
 * p.ej. la final — sin esperar al cron. Idempotente: upsert de resultados +
 * chequeo de firmas, así que darle varias veces es seguro.
 */
export async function forceResolution(): Promise<ForceResolutionResult> {
  await requireSuperAdmin()
  try {
    const { summary, notifiedCategories } = await runResolution()
    revalidatePath('/admin/sistema')
    const processed = Object.keys(summary).length
    return {
      ok: true,
      message: `Resolución corrida: ${processed} categorías procesadas, ${notifiedCategories} nuevas resueltas.`,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
