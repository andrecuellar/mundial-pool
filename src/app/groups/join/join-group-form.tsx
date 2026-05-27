'use client'

import { AlertTriangle } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { joinGroup } from '@/features/groups/actions'

const CODE_LEN = 6
const ALPHABET = /[^A-Z0-9]/g

export function JoinGroupForm() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function sanitize(raw: string): string {
    return raw.toUpperCase().replace(ALPHABET, '').slice(0, CODE_LEN)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = sanitize(code)
    if (clean.length !== CODE_LEN) {
      setError('Completa los 6 caracteres.')
      return
    }
    startTransition(async () => {
      const fd = new FormData()
      fd.set('inviteCode', clean)
      const r = await joinGroup(fd)
      if (r.ok) {
        window.location.href = `/groups/${r.data.slug}`
      } else {
        setError(r.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        value={code}
        onChange={(e) => {
          setError(null)
          setCode(sanitize(e.target.value))
        }}
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={CODE_LEN}
        placeholder="K7M2XQ"
        aria-label="Código de invitación"
        className={`h-16 text-center font-mono text-3xl font-semibold uppercase tabular-nums tracking-[0.4em] sm:tracking-[0.6em] ${
          error
            ? 'border-destructive bg-destructive/5'
            : code.length === CODE_LEN
              ? 'border-primary bg-primary/5 text-foreground'
              : ''
        }`}
      />

      <p className="text-center text-xs text-muted-foreground">
        Pega el código directamente o escríbelo. {code.length} / {CODE_LEN}
      </p>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm leading-relaxed">
              <span className="font-medium">{error}</span>{' '}
              <span className="text-muted-foreground">Verifica el código con quien te invitó.</span>
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2 pt-2">
        <Button
          type="submit"
          disabled={pending || code.length !== CODE_LEN}
          size="lg"
          className="w-full"
        >
          {pending ? 'Verificando…' : 'Unirme'}
        </Button>
        <Button asChild variant="ghost" size="lg" className="w-full">
          <a href="/">Cancelar</a>
        </Button>
      </div>
    </form>
  )
}
