'use client'

import { useState, useTransition } from 'react'
import { sendMagicLink } from '@/features/auth/actions'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'sent' } | { kind: 'error'; msg: string }
  >({ kind: 'idle' })
  const [pending, startTransition] = useTransition()

  function handleGoogle() {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  function handleMagicLink(formData: FormData) {
    formData.set('redirectOrigin', window.location.origin)
    startTransition(async () => {
      const result = await sendMagicLink(formData)
      if (result.ok) setStatus({ kind: 'sent' })
      else setStatus({ kind: 'error', msg: result.error })
    })
  }

  return (
    <div style={{ maxWidth: 360, margin: '4rem auto', fontFamily: 'sans-serif' }}>
      <h1>mundial-pool</h1>
      <p>Ingresa con tu cuenta de Google o recibe un link por email.</p>

      <button
        type="button"
        onClick={handleGoogle}
        style={{ width: '100%', padding: '0.75rem', marginTop: '1rem' }}
      >
        Continuar con Google
      </button>

      <div style={{ margin: '1.5rem 0', textAlign: 'center', color: '#888' }}>o</div>

      <form action={handleMagicLink}>
        <input
          name="email"
          type="email"
          required
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', boxSizing: 'border-box' }}
        />
        <button
          type="submit"
          disabled={pending}
          style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
        >
          {pending ? 'Enviando...' : 'Enviar magic link'}
        </button>
      </form>

      {status.kind === 'sent' && (
        <p style={{ color: 'green', marginTop: '1rem' }}>
          Revisa tu bandeja de entrada. El link expira en 1 hora.
        </p>
      )}
      {status.kind === 'error' && (
        <p style={{ color: 'crimson', marginTop: '1rem' }}>{status.msg}</p>
      )}
    </div>
  )
}
