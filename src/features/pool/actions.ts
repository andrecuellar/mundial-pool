'use server'

import { and, eq } from 'drizzle-orm'
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
  qrUrl: z.string().url().nullable(),
  payoutRule: z.enum(['winner_takes_all', 'top_3_split', 'manual']),
})

const transactionSchema = z.object({
  groupId: z.uuid(),
  amount: z.number().positive().max(9_999_999_999.99),
  currency: z.string().min(1).max(8),
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
    return { error: 'Solo el owner del grupo puede configurar el pozo.' }
  }
  return { userId: user.id }
}

export async function updatePoolConfig(input: unknown): Promise<PoolActionResult> {
  const parsed = configSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Configuración inválida.' }

  const auth = await requireOwner(parsed.data.groupId)
  if ('error' in auth) return { ok: false, error: auth.error }

  await db
    .update(groups)
    .set({
      poolEnabled: parsed.data.enabled,
      poolCurrency: parsed.data.currency,
      poolQrUrl: parsed.data.qrUrl,
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

  await db.insert(poolTransactions).values({
    groupId: parsed.data.groupId,
    amount: parsed.data.amount.toFixed(2),
    currency: parsed.data.currency,
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
