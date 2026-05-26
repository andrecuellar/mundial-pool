'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const magicLinkSchema = z.object({
  email: z.email(),
  redirectOrigin: z.string().url(),
  next: z.string().optional(),
})

export type MagicLinkResult = { ok: true } | { ok: false; error: string }

function safeNext(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (!raw.startsWith('/') || raw.startsWith('//')) return undefined
  if (raw.startsWith('/login') || raw.startsWith('/auth/')) return undefined
  return raw
}

export async function sendMagicLink(formData: FormData): Promise<MagicLinkResult> {
  const parsed = magicLinkSchema.safeParse({
    email: formData.get('email'),
    redirectOrigin: formData.get('redirectOrigin'),
    next: formData.get('next') ?? undefined,
  })
  if (!parsed.success) {
    return { ok: false, error: 'Email inválido.' }
  }

  const next = safeNext(parsed.data.next)
  const callback = next
    ? `${parsed.data.redirectOrigin}/auth/callback?next=${encodeURIComponent(next)}`
    : `${parsed.data.redirectOrigin}/auth/callback`

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: callback,
      shouldCreateUser: true,
    },
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
