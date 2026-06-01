import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { groupMembers, predictionReactions, predictions, profiles } from '@/db/schema'

export const ALLOWED_REACTION_EMOJIS = ['🔥', '😂', '💀', '👀', '🤡', '🤌'] as const
export type ReactionEmoji = (typeof ALLOWED_REACTION_EMOJIS)[number]

export type ReactionBucket = {
  emoji: string
  count: number
  reactedByMe: boolean
  reactors: string[] // display names
}

export type PredictionReactionsKey = string // `${userId}-${categoryId}`

export async function getGroupReactions(
  groupId: string,
  meUserId: string,
): Promise<Map<string, ReactionBucket[]>> {
  // Pull every reaction for predictions belonging to this group.
  const rows = await db
    .select({
      predictionId: predictionReactions.predictionId,
      reactorId: predictionReactions.userId,
      reactorName: profiles.displayName,
      emoji: predictionReactions.emoji,
      // Compose the key from the prediction's userId + categoryId for the
      // client mapping (predictions are unique per (group, user, category)).
      predUserId: predictions.userId,
      predCategoryId: predictions.categoryId,
    })
    .from(predictionReactions)
    .innerJoin(predictions, eq(predictions.id, predictionReactions.predictionId))
    .innerJoin(profiles, eq(profiles.id, predictionReactions.userId))
    .where(eq(predictions.groupId, groupId))

  const byKey = new Map<string, Map<string, ReactionBucket>>()
  for (const r of rows) {
    const key = `${r.predUserId}-${r.predCategoryId}`
    let perKey = byKey.get(key)
    if (!perKey) {
      perKey = new Map()
      byKey.set(key, perKey)
    }
    let bucket = perKey.get(r.emoji)
    if (!bucket) {
      bucket = { emoji: r.emoji, count: 0, reactedByMe: false, reactors: [] }
      perKey.set(r.emoji, bucket)
    }
    bucket.count++
    bucket.reactors.push(r.reactorName)
    if (r.reactorId === meUserId) bucket.reactedByMe = true
  }
  const out = new Map<string, ReactionBucket[]>()
  for (const [k, perKey] of byKey) out.set(k, Array.from(perKey.values()))
  return out
}

/** Confirm the user belongs to the group that owns this prediction. */
export async function isUserInPredictionGroup(predictionId: string, userId: string) {
  const row = await db
    .select({ groupId: predictions.groupId })
    .from(predictions)
    .where(eq(predictions.id, predictionId))
    .limit(1)
  if (row.length === 0) return false
  const member = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, row[0].groupId), eq(groupMembers.userId, userId)))
    .limit(1)
  return member.length > 0
}

export async function ensurePredictionsExistForKeys(
  groupId: string,
  keys: { userId: string; categoryId: string }[],
): Promise<Map<string, string>> {
  // Returns map "userId-categoryId" → predictionId.
  if (keys.length === 0) return new Map()
  const rows = await db
    .select({
      id: predictions.id,
      userId: predictions.userId,
      categoryId: predictions.categoryId,
    })
    .from(predictions)
    .where(
      and(
        eq(predictions.groupId, groupId),
        inArray(
          predictions.userId,
          keys.map((k) => k.userId),
        ),
      ),
    )
  const m = new Map<string, string>()
  for (const r of rows) m.set(`${r.userId}-${r.categoryId}`, r.id)
  return m
}
