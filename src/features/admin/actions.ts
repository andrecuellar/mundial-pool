'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { appState, profiles } from '@/db/schema'
import { FINAL_ODDS_KEY } from '@/features/tournament/win-probabilities'
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
const finalOddsSchema = z.object({
  odds: z
    .array(z.object({ teamId: z.uuid(), pct: z.number().min(0).max(100) }))
    .min(1)
    .max(4),
})

/** Cuotas de campeón entre los finalistas (0-100), que alimentan las
 *  probabilidades mostradas en las cards. Se guardan por teamId en app_state. */
export async function setFinalChampionOdds(input: unknown): Promise<AdminActionResult> {
  await requireSuperAdmin()
  const parsed = finalOddsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos.' }
  const map: Record<string, number> = {}
  for (const o of parsed.data.odds) map[o.teamId] = o.pct
  await db
    .insert(appState)
    .values({ key: FINAL_ODDS_KEY, value: JSON.stringify(map), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appState.key,
      set: { value: JSON.stringify(map), updatedAt: new Date() },
    })
  revalidateTag('odds', 'hours')
  revalidatePath('/admin/sistema')
  return { ok: true }
}

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
