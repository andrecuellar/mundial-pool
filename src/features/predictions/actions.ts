'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { categories, groupCategories, groupMembers, groups, predictions, teams } from '@/db/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type SubmitResult = { ok: true } | { ok: false; error: string }

type IncomingValue =
  | { kind: 'team'; teamId: string | null }
  | { kind: 'team_set'; teamIds: string[] }
  | { kind: 'player'; playerText: string | null }
  | { kind: 'empty' }

function parseFormValues(
  formData: FormData,
  cats: { id: string; key: string; valueKind: string; metadata: unknown }[],
): Map<string, IncomingValue> {
  const result = new Map<string, IncomingValue>()
  for (const c of cats) {
    if (c.valueKind === 'team') {
      const raw = formData.get(`cat:${c.key}`)
      const v = typeof raw === 'string' && raw.length > 0 ? raw : null
      result.set(c.id, v ? { kind: 'team', teamId: v } : { kind: 'empty' })
      continue
    }
    if (c.valueKind === 'team_set') {
      const all = formData
        .getAll(`cat:${c.key}`)
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
      result.set(c.id, all.length > 0 ? { kind: 'team_set', teamIds: all } : { kind: 'empty' })
      continue
    }
    if (c.valueKind === 'player') {
      const raw = formData.get(`cat:${c.key}`)
      const v = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
      result.set(c.id, v ? { kind: 'player', playerText: v } : { kind: 'empty' })
    }
  }
  return result
}

export async function submitPredictions(
  groupSlug: string,
  formData: FormData,
): Promise<SubmitResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado.' }

  const group = await db.query.groups.findFirst({ where: eq(groups.slug, groupSlug) })
  if (!group) return { ok: false, error: 'Grupo no encontrado.' }

  if (new Date() >= group.predictionsLockAt) {
    return { ok: false, error: 'Las predicciones de este grupo ya están bloqueadas.' }
  }

  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id)),
  })
  if (!membership) return { ok: false, error: 'No perteneces a este grupo.' }

  const cats = await db
    .select({
      id: categories.id,
      key: categories.key,
      valueKind: categories.valueKind,
      metadata: categories.metadata,
    })
    .from(categories)
    .innerJoin(groupCategories, eq(groupCategories.categoryId, categories.id))
    .where(and(eq(groupCategories.groupId, group.id), eq(groupCategories.enabled, true)))

  const incoming = parseFormValues(formData, cats)

  // Validate team_set sizes via metadata.n if present.
  for (const c of cats) {
    const v = incoming.get(c.id)
    if (v?.kind === 'team_set') {
      const expected = (c.metadata as { n?: number } | null)?.n
      if (expected != null && v.teamIds.length !== expected) {
        return {
          ok: false,
          error: `La categoría "${c.key}" requiere exactamente ${expected} selecciones.`,
        }
      }
      if (new Set(v.teamIds).size !== v.teamIds.length) {
        return { ok: false, error: `La categoría "${c.key}" no acepta selecciones repetidas.` }
      }
    }
  }

  // Validate team IDs exist (cheap one-shot check).
  const allTeamIds = new Set<string>()
  for (const v of incoming.values()) {
    if (v.kind === 'team' && v.teamId) allTeamIds.add(v.teamId)
    if (v.kind === 'team_set') for (const id of v.teamIds) allTeamIds.add(id)
  }
  if (allTeamIds.size > 0) {
    const rows = await db
      .select({ id: teams.id })
      .from(teams)
      .where(inArray(teams.id, Array.from(allTeamIds)))
    if (rows.length !== allTeamIds.size) {
      return { ok: false, error: 'Una de las selecciones elegidas no existe.' }
    }
  }

  // Upsert each prediction. Empty entries delete any existing row for that category.
  await db.transaction(async (tx) => {
    for (const c of cats) {
      const v = incoming.get(c.id) ?? { kind: 'empty' as const }
      if (v.kind === 'empty') {
        await tx
          .delete(predictions)
          .where(
            and(
              eq(predictions.groupId, group.id),
              eq(predictions.userId, user.id),
              eq(predictions.categoryId, c.id),
            ),
          )
        continue
      }
      await tx
        .insert(predictions)
        .values({
          groupId: group.id,
          userId: user.id,
          categoryId: c.id,
          teamId: v.kind === 'team' ? v.teamId : null,
          teamSet: v.kind === 'team_set' ? v.teamIds : null,
          playerText: v.kind === 'player' ? v.playerText : null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [predictions.groupId, predictions.userId, predictions.categoryId],
          set: {
            teamId: v.kind === 'team' ? v.teamId : null,
            teamSet: v.kind === 'team_set' ? v.teamIds : null,
            playerText: v.kind === 'player' ? v.playerText : null,
            updatedAt: new Date(),
          },
        })
    }
  })

  revalidatePath(`/groups/${groupSlug}`)
  revalidatePath(`/groups/${groupSlug}/leaderboard`)
  return { ok: true }
}
