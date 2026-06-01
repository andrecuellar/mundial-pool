'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function markOnboarded(): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  await db.update(profiles).set({ onboardedAt: new Date() }).where(eq(profiles.id, user.id))

  return { ok: true }
}
