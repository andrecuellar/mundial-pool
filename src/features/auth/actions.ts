'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const magicLinkSchema = z.object({
  email: z.email(),
  redirectOrigin: z.string().url(),
  next: z.string().optional(),
})

export type MagicLinkErrorCode =
  | 'invalid_email'
  | 'rate_limited'
  | 'cooldown'
  | 'other'

export type MagicLinkResult =
  | { ok: true }
  | {
      ok: false
      code: MagicLinkErrorCode
      error: string
      retryAfterSeconds?: number
    }

function safeNext(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (!raw.startsWith('/') || raw.startsWith('//')) return undefined
  if (raw.startsWith('/login') || raw.startsWith('/auth/')) return undefined
  return raw
}

// Map Supabase Auth's English error messages into typed codes + friendly
// Spanish copy. Two distinct cases we care about:
//   - "Email rate limit exceeded" — project-wide hourly cap on the built-in
//     SMTP. Hits every user until the hour rolls over.
//   - "For security purposes, you can only request this after N seconds" —
//     per-endpoint 60s window between requests. Self-resolves quickly.
function classifyAuthError(raw: string): {
  code: MagicLinkErrorCode
  error: string
  retryAfterSeconds?: number
} {
  const msg = raw.toLowerCase()

  if (msg.includes('rate limit') && msg.includes('email')) {
    return {
      code: 'rate_limited',
      error:
        'Servicio de correo saturado. Para entrar sin esperar, usá Continuar con Google.',
    }
  }

  const secsMatch = raw.match(/after\s+(\d+)\s+seconds?/i)
  if (secsMatch) {
    const secs = Number(secsMatch[1])
    return {
      code: 'cooldown',
      error: `Esperá ${secs} segundos antes de pedir otro link.`,
      retryAfterSeconds: secs,
    }
  }

  return {
    code: 'other',
    error: 'No pudimos enviar el link. Probá de nuevo en un momento.',
  }
}

export async function sendMagicLink(formData: FormData): Promise<MagicLinkResult> {
  const parsed = magicLinkSchema.safeParse({
    email: formData.get('email'),
    redirectOrigin: formData.get('redirectOrigin'),
    next: formData.get('next') ?? undefined,
  })
  if (!parsed.success) {
    return { ok: false, code: 'invalid_email', error: 'Email inválido.' }
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
  if (error) return { ok: false, ...classifyAuthError(error.message) }
  return { ok: true }
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
