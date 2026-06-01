import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const Body = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
})

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const { endpoint, keys, userAgent } = parsed.data
  await db
    .insert(pushSubscriptions)
    .values({
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    })
    .onConflictDoNothing()

  return NextResponse.json({ ok: true })
}
