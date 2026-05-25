import type { User } from '@supabase/supabase-js'
import { db } from '@/db'
import { profiles } from '@/db/schema'

function displayNameFromUser(user: User): string {
  const meta = user.user_metadata ?? {}
  const candidates = [
    meta.full_name,
    meta.name,
    [meta.first_name, meta.last_name].filter(Boolean).join(' '),
    meta.user_name,
    user.email?.split('@')[0],
  ]
  return candidates.find((c): c is string => typeof c === 'string' && c.length > 0) ?? 'Player'
}

function avatarFromUser(user: User): string | null {
  const meta = user.user_metadata ?? {}
  return meta.avatar_url ?? meta.picture ?? null
}

export async function upsertProfileFromAuth(user: User) {
  await db
    .insert(profiles)
    .values({
      id: user.id,
      displayName: displayNameFromUser(user),
      avatarUrl: avatarFromUser(user),
      email: user.email ?? null,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        displayName: displayNameFromUser(user),
        avatarUrl: avatarFromUser(user),
        email: user.email ?? null,
      },
    })
}
