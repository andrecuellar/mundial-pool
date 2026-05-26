'use server'

import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/db'
import { groupMembers, groups } from '@/db/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { generateInviteCode, slugify } from './helpers'

const createGroupSchema = z.object({
  name: z.string().min(2).max(60),
  predictionsLockAt: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
  poolEnabled: z.boolean().optional(),
  poolCurrency: z.string().min(1).max(8).optional(),
  poolPayoutRule: z.enum(['winner_takes_all', 'top_3_split', 'manual']).optional(),
})

const joinGroupSchema = z.object({
  inviteCode: z.string().min(4).max(12),
})

export type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string }

async function requireUserId(): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('not_authenticated')
  return user.id
}

export async function createGroup(formData: FormData): Promise<ActionResult<{ slug: string }>> {
  const poolEnabled = formData.get('poolEnabled') === 'on'
  const parsed = createGroupSchema.safeParse({
    name: formData.get('name'),
    predictionsLockAt: formData.get('predictionsLockAt'),
    poolEnabled,
    poolCurrency: poolEnabled ? (formData.get('poolCurrency') ?? 'BOB') : undefined,
    poolPayoutRule: poolEnabled
      ? (formData.get('poolPayoutRule') ?? 'winner_takes_all')
      : undefined,
  })
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Nombre y fecha de bloqueo son requeridos.' }
  }

  let userId: string
  try {
    userId = await requireUserId()
  } catch {
    return { ok: false, error: 'Necesitas estar autenticado.' }
  }

  const baseSlug = slugify(parsed.data.name) || 'grupo'
  let slug = baseSlug
  let suffix = 0
  // Avoid slug collisions with a small probe loop.
  // 5 attempts max is plenty for a small product.
  for (let i = 0; i < 5; i++) {
    const existing = await db.query.groups.findFirst({ where: eq(groups.slug, slug) })
    if (!existing) break
    suffix += 1
    slug = `${baseSlug}-${suffix}`
  }

  // 32^6 ≈ 1.07B codes, but we still probe before insert because the
  // invite_code column is UNIQUE and a clash would throw on commit.
  let inviteCode = generateInviteCode(6)
  for (let i = 0; i < 5; i++) {
    const existing = await db.query.groups.findFirst({
      where: eq(groups.inviteCode, inviteCode),
    })
    if (!existing) break
    inviteCode = generateInviteCode(6)
  }
  const lockAt = new Date(parsed.data.predictionsLockAt)

  const created = await db.transaction(async (tx) => {
    const [g] = await tx
      .insert(groups)
      .values({
        name: parsed.data.name,
        slug,
        inviteCode,
        createdBy: userId,
        predictionsLockAt: lockAt,
        poolEnabled: parsed.data.poolEnabled ?? false,
        poolCurrency: parsed.data.poolCurrency ?? null,
        poolPayoutRule: parsed.data.poolPayoutRule ?? 'winner_takes_all',
      })
      .returning()

    await tx.insert(groupMembers).values({ groupId: g.id, userId, role: 'owner' })

    // Copy defaults from categories -> group_categories
    await tx.execute(sql`
      INSERT INTO group_categories (group_id, category_id, points, enabled)
      SELECT ${g.id}::uuid, id, default_points, true
      FROM categories
    `)

    return g
  })

  revalidatePath('/')
  return { ok: true, data: { slug: created.slug } }
}

export async function joinGroup(formData: FormData): Promise<ActionResult<{ slug: string }>> {
  const parsed = joinGroupSchema.safeParse({
    inviteCode: (formData.get('inviteCode') ?? '').toString().toUpperCase().trim(),
  })
  if (!parsed.success) {
    return { ok: false, error: 'Código inválido.' }
  }

  let userId: string
  try {
    userId = await requireUserId()
  } catch {
    return { ok: false, error: 'Necesitas estar autenticado.' }
  }

  const group = await db.query.groups.findFirst({
    where: eq(groups.inviteCode, parsed.data.inviteCode),
  })
  if (!group) {
    return { ok: false, error: 'No encontramos un grupo con ese código.' }
  }

  await db
    .insert(groupMembers)
    .values({ groupId: group.id, userId, role: 'member' })
    .onConflictDoNothing()

  revalidatePath('/')
  return { ok: true, data: { slug: group.slug } }
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  let userId: string
  try {
    userId = await requireUserId()
  } catch {
    return { ok: false, error: 'Necesitas estar autenticado.' }
  }

  // Admins (the creator) cannot leave (would orphan the group). UI shouldn't show the button.
  const membership = await db.query.groupMembers.findFirst({
    where: (gm, { and, eq: eqOp }) => and(eqOp(gm.groupId, groupId), eqOp(gm.userId, userId)),
  })
  if (!membership) return { ok: false, error: 'No eres miembro de este grupo.' }
  if (membership.role === 'owner') {
    return { ok: false, error: 'El admin del grupo no puede salir; debe eliminar el grupo.' }
  }

  await db
    .delete(groupMembers)
    .where(sql`group_id = ${groupId}::uuid AND user_id = ${userId}::uuid`)

  revalidatePath('/')
  return { ok: true }
}

export async function createGroupAndRedirect(formData: FormData): Promise<void> {
  const result = await createGroup(formData)
  if (!result.ok) throw new Error(result.error)
  redirect(`/groups/${result.data.slug}`)
}

export async function joinGroupAndRedirect(formData: FormData): Promise<void> {
  const result = await joinGroup(formData)
  if (!result.ok) throw new Error(result.error)
  redirect(`/groups/${result.data.slug}`)
}
