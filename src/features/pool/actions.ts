'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { groupMembers, groups, poolTransactions } from '@/db/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type PoolActionResult = { ok: true } | { ok: false; error: string }

const configSchema = z.object({
  groupId: z.uuid(),
  enabled: z.boolean(),
  currency: z.string().min(1).max(8).nullable(),
  buyInAmount: z.number().positive().max(9_999_999_999.99),
  payoutRule: z.enum(['winner_takes_all', 'top_3_split', 'manual']),
})

const transactionSchema = z.object({
  groupId: z.uuid(),
  contributorUserId: z.uuid().nullable(),
  contributorLabel: z.string().max(60).nullable(),
  note: z.string().max(280).nullable(),
})

async function requireOwner(groupId: string): Promise<{ userId: string } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }
  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
  })
  if (!membership) return { error: 'No perteneces a este grupo.' }
  if (membership.role !== 'owner') {
    return { error: 'Solo el admin del grupo puede configurar el pozo.' }
  }
  return { userId: user.id }
}

export async function updatePoolConfig(input: unknown): Promise<PoolActionResult> {
  const parsed = configSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Configuración inválida.' }

  const auth = await requireOwner(parsed.data.groupId)
  if ('error' in auth) return { ok: false, error: auth.error }

  // Defense in depth: if the pool already has deposits, prevent currency
  // changes even if the client sent one. The form disables the input, but we
  // verify on the server.
  const current = await db.query.groups.findFirst({
    where: eq(groups.id, parsed.data.groupId),
  })
  const [{ depositCount }] = await db
    .select({ depositCount: sql<number>`COUNT(*)::int` })
    .from(poolTransactions)
    .where(eq(poolTransactions.groupId, parsed.data.groupId))
  if (
    depositCount > 0 &&
    current?.poolCurrency &&
    parsed.data.currency &&
    current.poolCurrency !== parsed.data.currency
  ) {
    return {
      ok: false,
      error: `No se puede cambiar la moneda con ${depositCount} depósito${depositCount === 1 ? '' : 's'} registrado${depositCount === 1 ? '' : 's'}. Elimínalos primero.`,
    }
  }
  // Same defense for the buy-in: once anyone has paid, changing the per-player
  // amount would create unfair splits. Owner must wipe deposits first.
  if (depositCount > 0 && current && Number(current.poolBuyInAmount) !== parsed.data.buyInAmount) {
    return {
      ok: false,
      error: `No se puede cambiar el monto del aporte con ${depositCount} depósito${depositCount === 1 ? '' : 's'} registrado${depositCount === 1 ? '' : 's'}. Elimínalos primero.`,
    }
  }

  await db
    .update(groups)
    .set({
      poolEnabled: parsed.data.enabled,
      poolCurrency: parsed.data.currency,
      poolBuyInAmount: parsed.data.buyInAmount.toFixed(2),
      poolPayoutRule: parsed.data.payoutRule,
    })
    .where(eq(groups.id, parsed.data.groupId))

  const slug = (
    await db.select({ slug: groups.slug }).from(groups).where(eq(groups.id, parsed.data.groupId))
  )[0]?.slug
  if (slug) revalidatePath(`/groups/${slug}`)
  return { ok: true }
}

export async function recordPoolTransaction(input: unknown): Promise<PoolActionResult> {
  const parsed = transactionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Datos del depósito inválidos.' }
  }
  const auth = await requireOwner(parsed.data.groupId)
  if ('error' in auth) return { ok: false, error: auth.error }

  // Amount and currency come from the group config, not the form — the buy-in
  // is fixed per group so everyone aporta exactly the same.
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, parsed.data.groupId),
  })
  if (!group) return { ok: false, error: 'Grupo no encontrado.' }
  if (!group.poolEnabled) return { ok: false, error: 'El pozo no está activado.' }
  if (!group.poolCurrency) return { ok: false, error: 'El pozo no tiene moneda configurada.' }

  await db.insert(poolTransactions).values({
    groupId: parsed.data.groupId,
    amount: group.poolBuyInAmount,
    currency: group.poolCurrency,
    contributorUserId: parsed.data.contributorUserId,
    contributorLabel: parsed.data.contributorLabel,
    note: parsed.data.note,
    createdByUserId: auth.userId,
  })

  const slug = (
    await db.select({ slug: groups.slug }).from(groups).where(eq(groups.id, parsed.data.groupId))
  )[0]?.slug
  if (slug) revalidatePath(`/groups/${slug}`)
  return { ok: true }
}

export async function deletePoolTransaction(input: {
  groupId: string
  transactionId: string
}): Promise<PoolActionResult> {
  const auth = await requireOwner(input.groupId)
  if ('error' in auth) return { ok: false, error: auth.error }

  await db
    .delete(poolTransactions)
    .where(
      and(
        eq(poolTransactions.id, input.transactionId),
        eq(poolTransactions.groupId, input.groupId),
      ),
    )

  const slug = (
    await db.select({ slug: groups.slug }).from(groups).where(eq(groups.id, input.groupId))
  )[0]?.slug
  if (slug) revalidatePath(`/groups/${slug}`)
  return { ok: true }
}
