'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getMagicLinkBlockedUntil,
  MAGIC_LINK_BACKOFF_MS,
  setMagicLinkBlockedUntil,
} from './rate-limit'

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
      blockedUntil?: string
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
      code: 'rate_limited' as const,
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

  // Global block check: if any device/user previously hit the cap, every
  // subsequent request is rejected before hitting Supabase so we don't burn
  // the next slot when the hour rolls over.
  const globalBlock = await getMagicLinkBlockedUntil()
  if (globalBlock) {
    return {
      ok: false,
      code: 'rate_limited',
      error: 'Servicio de correo saturado. Para entrar sin esperar, usá Continuar con Google.',
      retryAfterSeconds: Math.ceil((globalBlock.getTime() - Date.now()) / 1000),
      blockedUntil: globalBlock.toISOString(),
    }
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
  if (!error) return { ok: true }

  const classified = classifyAuthError(error.message)
  // Promote the rate-limit error into a global block so every other device
  // also stops trying — Supabase's cap is project-wide.
  if (classified.code === 'rate_limited') {
    const until = new Date(Date.now() + MAGIC_LINK_BACKOFF_MS)
    await setMagicLinkBlockedUntil(until)
    return {
      ok: false,
      ...classified,
      retryAfterSeconds: Math.ceil(MAGIC_LINK_BACKOFF_MS / 1000),
      blockedUntil: until.toISOString(),
    }
  }
  return { ok: false, ...classified }
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
