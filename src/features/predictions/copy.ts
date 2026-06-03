'use server'

import { track } from '@vercel/analytics/server'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { groupCategories, groupMembers, groups, predictions } from '@/db/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const copySchema = z.object({
  sourceGroupId: z.uuid(),
  destGroupIds: z.array(z.uuid()).min(1).max(10),
  overwrite: z.boolean().optional(),
})

type GroupConflict = { groupId: string; groupName: string; count: number }

export type CopyPredictionsResult =
  | { ok: true; copiedTo: { groupId: string; groupName: string; count: number }[] }
  | { ok: false; code: 'needs_confirmation'; groupsWithPredictions: GroupConflict[] }
  | { ok: false; code?: 'invalid' | 'forbidden' | 'empty_source' | 'locked'; error: string }

export async function copyPredictions(input: unknown): Promise<CopyPredictionsResult> {
  const parsed = copySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, code: 'invalid', error: 'Datos inválidos.' }
  }
  const { sourceGroupId, destGroupIds, overwrite } = parsed.data

  if (destGroupIds.includes(sourceGroupId)) {
    return { ok: false, code: 'invalid', error: 'El grupo de origen no puede ser destino.' }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado.' }

  // Source group + membership.
  const sourceMembership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, sourceGroupId), eq(groupMembers.userId, user.id)),
  })
  if (!sourceMembership) {
    return { ok: false, code: 'forbidden', error: 'No perteneces al grupo de origen.' }
  }

  // Source predictions for this user.
  const sourcePredictions = await db
    .select({
      categoryId: predictions.categoryId,
      teamId: predictions.teamId,
      teamSet: predictions.teamSet,
      playerText: predictions.playerText,
    })
    .from(predictions)
    .where(and(eq(predictions.groupId, sourceGroupId), eq(predictions.userId, user.id)))

  if (sourcePredictions.length === 0) {
    return {
      ok: false,
      code: 'empty_source',
      error: 'El grupo de origen no tiene predicciones para copiar.',
    }
  }

  // Destination groups + membership + lock check (one round-trip each).
  const destGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      slug: groups.slug,
      predictionsLockAt: groups.predictionsLockAt,
    })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(and(inArray(groups.id, destGroupIds), eq(groupMembers.userId, user.id)))

  if (destGroups.length !== destGroupIds.length) {
    return {
      ok: false,
      code: 'forbidden',
      error: 'No perteneces a alguno de los grupos de destino.',
    }
  }

  const now = new Date()
  const lockedDest = destGroups.find((g) => now >= g.predictionsLockAt)
  if (lockedDest) {
    return {
      ok: false,
      code: 'locked',
      error: `El grupo "${lockedDest.name}" ya está bloqueado, no se puede copiar a él.`,
    }
  }

  // Existing predictions count per dest — used both for the overwrite gate
  // and so the success toast can say "X copied to Y".
  const existingCounts = await db
    .select({
      groupId: predictions.groupId,
      n: sql<number>`COUNT(*)::int`,
    })
    .from(predictions)
    .where(and(inArray(predictions.groupId, destGroupIds), eq(predictions.userId, user.id)))
    .groupBy(predictions.groupId)
  const existingByGroup = new Map(existingCounts.map((r) => [r.groupId, r.n]))

  if (!overwrite) {
    const groupsWithPredictions = destGroups
      .filter((g) => (existingByGroup.get(g.id) ?? 0) > 0)
      .map((g) => ({
        groupId: g.id,
        groupName: g.name,
        count: existingByGroup.get(g.id) ?? 0,
      }))
    if (groupsWithPredictions.length > 0) {
      return { ok: false, code: 'needs_confirmation', groupsWithPredictions }
    }
  }

  // Which categories each dest accepts. Categories not enabled in a dest are
  // skipped during the copy (the dest's group_categories is the source of truth
  // for what's writable).
  const enabledRows = await db
    .select({
      groupId: groupCategories.groupId,
      categoryId: groupCategories.categoryId,
    })
    .from(groupCategories)
    .where(and(inArray(groupCategories.groupId, destGroupIds), eq(groupCategories.enabled, true)))
  const enabledByGroup = new Map<string, Set<string>>()
  for (const row of enabledRows) {
    const set = enabledByGroup.get(row.groupId) ?? new Set<string>()
    set.add(row.categoryId)
    enabledByGroup.set(row.groupId, set)
  }

  // Apply the copy atomically. One bulk UPSERT per dest — the `excluded` rows
  // come from the VALUES list, so a single statement covers all 14 categories.
  const copiedTo: { groupId: string; groupName: string; count: number }[] = []
  await db.transaction(async (tx) => {
    for (const dest of destGroups) {
      const enabledSet = enabledByGroup.get(dest.id) ?? new Set()
      const rows = sourcePredictions
        .filter((src) => enabledSet.has(src.categoryId))
        .map((src) => ({
          groupId: dest.id,
          userId: user.id,
          categoryId: src.categoryId,
          teamId: src.teamId,
          teamSet: src.teamSet,
          playerText: src.playerText,
          updatedAt: now,
        }))
      if (rows.length > 0) {
        await tx
          .insert(predictions)
          .values(rows)
          .onConflictDoUpdate({
            target: [predictions.groupId, predictions.userId, predictions.categoryId],
            set: {
              teamId: sql`excluded.team_id`,
              teamSet: sql`excluded.team_set`,
              playerText: sql`excluded.player_text`,
              updatedAt: sql`excluded.updated_at`,
            },
          })
      }
      copiedTo.push({ groupId: dest.id, groupName: dest.name, count: rows.length })
    }
  })

  // Refresh anything affected. Home for chips + each dest group's pages.
  revalidatePath('/')
  for (const dest of destGroups) {
    revalidatePath(`/groups/${dest.slug}`)
    revalidatePath(`/groups/${dest.slug}/predict`)
    revalidatePath(`/groups/${dest.slug}/comprobante`)
    revalidatePath(`/groups/${dest.slug}/leaderboard`)
  }

  after(() =>
    track('predictions_copied', {
      destCount: destGroups.length,
      overwriteUsed: overwrite ?? false,
    }).catch((e) => console.error('analytics predictions_copied failed', e)),
  )

  return { ok: true, copiedTo }
}
