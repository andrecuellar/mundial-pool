'use client'

import { Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Team = { id: string; name: string; flagEmoji: string | null; fifaCode: string | null }

type Props = {
  teams: Team[]
  selected: string[]
  onChange: (next: string[]) => void
  n: number
  disabled?: boolean
}

export function TeamSetGrid({ teams, selected, onChange, n, disabled }: Props) {
  const [query, setQuery] = useState('')
  const set = new Set(selected)
  const filtered = teams.filter((t) => {
    if (!query) return true
    const q = query.toLowerCase()
    return t.name.toLowerCase().includes(q) || (t.fifaCode ?? '').toLowerCase().includes(q)
  })

  function toggle(id: string) {
    if (set.has(id)) {
      onChange(selected.filter((x) => x !== id))
    } else if (selected.length < n) {
      onChange([...selected, id])
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Toca para seleccionar. Sin orden.</p>
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-sm font-semibold tabular-nums ${
              selected.length === n ? 'text-success' : 'text-foreground'
            }`}
          >
            {selected.length} / {n}
          </span>
          {selected.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
              disabled={disabled}
              className="h-7 px-2 text-xs"
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar selección…"
        className="h-9 text-sm"
        disabled={disabled}
      />

      <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-border p-1.5 sm:grid-cols-3 lg:grid-cols-2">
        {filtered.map((t) => {
          const isSelected = set.has(t.id)
          const atCap = !isSelected && selected.length >= n
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              disabled={disabled || atCap}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : atCap
                    ? 'border-border bg-card opacity-40 cursor-not-allowed'
                    : 'border-border bg-card hover:bg-muted/40'
              }`}
            >
              <span className="text-base leading-none">{t.flagEmoji ?? '🏳️'}</span>
              <span className="flex-1 truncate font-medium">{t.name}</span>
              {isSelected && (
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
