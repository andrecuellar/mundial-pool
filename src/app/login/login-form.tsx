'use client'

import { AlertTriangle, Clock, Mail } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendMagicLink } from '@/features/auth/actions'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

type Props = {
  /** Path to return to after a successful sign-in (e.g. /join/CODE). */
  next?: string
  /**
   * ISO timestamp until which the magic-link button is globally blocked
   * because Supabase's email cap was hit. Read from the database on the
   * server so the block is shared across devices and reloads.
   */
  magicLinkBlockedUntil?: string | null
}

const RATE_LIMITED_MESSAGE =
  'Servicio de correo saturado. Para entrar sin esperar, usa Continuar con Google.'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" role="img" aria-label="Google">
      <title>Google</title>
      <path
        d="M21.35 11.1H12v3.2h5.35c-.5 2.4-2.6 3.6-5.35 3.6-3.2 0-5.8-2.6-5.8-5.9s2.6-5.9 5.8-5.9c1.4 0 2.7.5 3.7 1.4l2.4-2.4C16.4 3.6 14.3 2.8 12 2.8c-5 0-9 4.1-9 9.2s4 9.2 9 9.2c5.2 0 8.6-3.6 8.6-8.8 0-.5 0-.9-.1-1.3z"
        fill="currentColor"
      />
    </svg>
  )
}

function callbackUrl(origin: string, next?: string): string {
  const base = `${origin}/auth/callback`
  if (!next) return base
  return `${base}?next=${encodeURIComponent(next)}`
}

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  if (totalSec >= 60) {
    const m = Math.ceil(totalSec / 60)
    return `${m} min`
  }
  return `${totalSec} s`
}

export function LoginForm({ next, magicLinkBlockedUntil }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'sent'; email: string }
    | { kind: 'cooldown'; msg: string; until: number }
    | { kind: 'rate_limited'; msg: string; until: number }
    | { kind: 'error'; msg: string }
  >(() => {
    if (!magicLinkBlockedUntil) return { kind: 'idle' }
    const ts = Date.parse(magicLinkBlockedUntil)
    if (!Number.isFinite(ts) || ts <= Date.now()) return { kind: 'idle' }
    return { kind: 'rate_limited', msg: RATE_LIMITED_MESSAGE, until: ts }
  })
  const [pending, startTransition] = useTransition()
  const [now, setNow] = useState(() => Date.now())

  // Tick the countdown when there is a pending cooldown.
  useEffect(() => {
    if (status.kind !== 'cooldown' && status.kind !== 'rate_limited') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [status.kind])

  // Auto-clear the cooldown once the deadline passes.
  useEffect(() => {
    if (status.kind !== 'cooldown' && status.kind !== 'rate_limited') return
    if (now >= status.until) setStatus({ kind: 'idle' })
  }, [now, status])

  const blockedUntil =
    status.kind === 'cooldown' || status.kind === 'rate_limited' ? status.until : 0
  const blockedRemaining = Math.max(0, blockedUntil - now)
  const blocked = blockedRemaining > 0

  function handleGoogle() {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl(window.location.origin, next) },
    })
  }

  function handleMagicLink(formData: FormData) {
    if (blocked) return
    formData.set('redirectOrigin', window.location.origin)
    if (next) formData.set('next', next)
    const sent = (formData.get('email') as string) ?? ''
    startTransition(async () => {
      const result = await sendMagicLink(formData)
      if (result.ok) {
        setStatus({ kind: 'sent', email: sent })
        return
      }
      if (result.code === 'rate_limited') {
        const fromServer = result.blockedUntil ? Date.parse(result.blockedUntil) : NaN
        const until = Number.isFinite(fromServer)
          ? fromServer
          : Date.now() + (result.retryAfterSeconds ?? 3600) * 1000
        setStatus({ kind: 'rate_limited', msg: result.error, until })
        return
      }
      if (result.code === 'cooldown') {
        const ms = (result.retryAfterSeconds ?? 60) * 1000
        setStatus({ kind: 'cooldown', msg: result.error, until: Date.now() + ms })
        return
      }
      setStatus({ kind: 'error', msg: result.error })
    })
  }

  if (status.kind === 'sent') {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent/10 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
            <Mail className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <div className="font-medium">Revisa tu correo</div>
            <p className="text-muted-foreground leading-relaxed">
              Te enviamos un link a{' '}
              <span className="font-medium text-foreground">{status.email}</span>. Expira en 1 hora.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={handleGoogle} variant="secondary" size="lg" className="w-full">
        <GoogleIcon />
        Continuar con Google
      </Button>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          o con tu correo
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={handleMagicLink} className="space-y-2">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            name="email"
            type="email"
            required
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={blocked}
            className="h-11 pl-9"
          />
        </div>
        <Button type="submit" disabled={pending || blocked} size="lg" className="w-full">
          {pending
            ? 'Enviando…'
            : blocked
              ? `Disponible en ${formatRemaining(blockedRemaining)}`
              : 'Enviar magic link'}
        </Button>
      </form>

      {status.kind === 'rate_limited' && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="text-sm leading-relaxed">
              <p className="font-medium">Servicio de correo saturado</p>
              <p className="mt-0.5 text-muted-foreground">
                Hay demasiadas solicitudes de magic link ahora mismo. Para entrar sin esperar, usa{' '}
                <span className="font-medium text-foreground">Continuar con Google</span> arriba. Si
                prefieres magic link, podrás pedirlo de nuevo en{' '}
                <span className="font-medium text-foreground">
                  {formatRemaining(blockedRemaining)}
                </span>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {status.kind === 'cooldown' && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-start gap-2.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-relaxed">
              Espera{' '}
              <span className="font-medium text-foreground">
                {formatRemaining(blockedRemaining)}
              </span>{' '}
              antes de pedir otro link a este correo.
            </p>
          </div>
        </div>
      )}

      {status.kind === 'error' && <p className="text-sm text-destructive">{status.msg}</p>}
    </div>
  )
}
