'use client'

import { AlertTriangle } from 'lucide-react'
import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { joinGroup } from '@/features/groups/actions'

const CODE_LEN = 6
const ALPHABET = /^[A-Z0-9]$/

export function JoinGroupForm() {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LEN).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function setAt(i: number, v: string) {
    setError(null)
    setDigits((prev) => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  function handleChange(i: number, raw: string) {
    const v = raw.toUpperCase().slice(-1)
    if (v && !ALPHABET.test(v)) return
    setAt(i, v)
    if (v && i < CODE_LEN - 1) refs.current[i + 1]?.focus()
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData
      .getData('text')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, CODE_LEN)
    if (!text) return
    e.preventDefault()
    const next = Array(CODE_LEN).fill('')
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    setDigits(next)
    refs.current[Math.min(text.length, CODE_LEN - 1)]?.focus()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = digits.join('')
    if (code.length !== CODE_LEN) {
      setError('Completa los 6 caracteres.')
      return
    }
    startTransition(async () => {
      const fd = new FormData()
      fd.set('inviteCode', code)
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
      <div className="flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            // biome-ignore lint/suspicious/noArrayIndexKey: positional OTP cells
            key={`cell-${i}`}
            ref={(el) => {
              refs.current[i] = el
            }}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            inputMode="text"
            maxLength={1}
            aria-label={`Caracter ${i + 1}`}
            className={`h-14 w-12 rounded-lg border-[1.5px] bg-card text-center font-mono text-2xl font-semibold tabular-nums uppercase outline-none transition-colors focus:ring-2 focus:ring-ring ${
              error
                ? 'border-destructive bg-destructive/5'
                : d
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground'
            }`}
          />
        ))}
      </div>

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
        <Button type="submit" disabled={pending} size="lg" className="w-full">
          {pending ? 'Verificando…' : 'Unirme'}
        </Button>
        <Button asChild variant="ghost" size="lg" className="w-full">
          <a href="/">Cancelar</a>
        </Button>
      </div>
    </form>
  )
}
