'use client'

import { Mail } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendMagicLink } from '@/features/auth/actions'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

type Props = {
  /** Path to return to after a successful sign-in (e.g. /join/CODE). */
  next?: string
}

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

export function LoginForm({ next }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'sent'; email: string } | { kind: 'error'; msg: string }
  >({ kind: 'idle' })
  const [pending, startTransition] = useTransition()

  function handleGoogle() {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl(window.location.origin, next) },
    })
  }

  function handleMagicLink(formData: FormData) {
    formData.set('redirectOrigin', window.location.origin)
    if (next) formData.set('next', next)
    const sent = (formData.get('email') as string) ?? ''
    startTransition(async () => {
      const result = await sendMagicLink(formData)
      if (result.ok) setStatus({ kind: 'sent', email: sent })
      else setStatus({ kind: 'error', msg: result.error })
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
            className="h-11 pl-9"
          />
        </div>
        <Button type="submit" disabled={pending} size="lg" className="w-full">
          {pending ? 'Enviando…' : 'Enviar magic link'}
        </Button>
      </form>

      {status.kind === 'error' && <p className="text-sm text-destructive">{status.msg}</p>}
    </div>
  )
}
