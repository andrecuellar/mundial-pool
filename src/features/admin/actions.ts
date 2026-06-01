'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { isSuperAdminEmail, requireSuperAdmin } from '@/lib/admin'

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

  revalidatePath('/admin/usuarios')
  revalidatePath(`/admin/usuarios/${userId}`)
  return { ok: true }
}
