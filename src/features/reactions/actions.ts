'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { groups, predictionReactions, predictions } from '@/db/schema'
import {
  ALLOWED_REACTION_EMOJIS,
  type ReactionEmoji,
  isUserInPredictionGroup,
} from '@/features/reactions/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type ToggleResult = { ok: true; nowReacted: boolean } | { ok: false; error: string }

export async function toggleReaction(
  predictionId: string,
  emoji: ReactionEmoji,
): Promise<ToggleResult> {
  if (!ALLOWED_REACTION_EMOJIS.includes(emoji)) {
    return { ok: false, error: 'Emoji no permitido.' }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado.' }

  // Membership + lock check in one shot.
  const predRow = await db
    .select({
      groupId: predictions.groupId,
      groupSlug: groups.slug,
      lockAt: groups.predictionsLockAt,
    })
    .from(predictions)
    .innerJoin(groups, eq(groups.id, predictions.groupId))
    .where(eq(predictions.id, predictionId))
    .limit(1)
  if (predRow.length === 0) return { ok: false, error: 'Predicción no encontrada.' }
  const { lockAt, groupSlug } = predRow[0]

  if (new Date() < lockAt) {
    return { ok: false, error: 'Solo podés reaccionar después del cierre.' }
  }

  const isMember = await isUserInPredictionGroup(predictionId, user.id)
  if (!isMember) return { ok: false, error: 'No perteneces al grupo.' }

  const existing = await db
    .select({ id: predictionReactions.id })
    .from(predictionReactions)
    .where(
      and(
        eq(predictionReactions.predictionId, predictionId),
        eq(predictionReactions.userId, user.id),
        eq(predictionReactions.emoji, emoji),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    await db.delete(predictionReactions).where(eq(predictionReactions.id, existing[0].id))
    revalidatePath(`/groups/${groupSlug}/predictions`)
    return { ok: true, nowReacted: false }
  }

  await db.insert(predictionReactions).values({
    predictionId,
    userId: user.id,
    emoji,
  })
  revalidatePath(`/groups/${groupSlug}/predictions`)
  return { ok: true, nowReacted: true }
}
