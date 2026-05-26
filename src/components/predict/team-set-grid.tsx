'use client'

import { Check, Lock } from 'lucide-react'
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
  /**
   * Team IDs that are locked into the selection (e.g. derived from champion +
   * runner_up + third_place when the parent is the Top 5 category). They appear
   * pre-selected and cannot be toggled off via this grid. They count toward the
   * cap n, so the user only picks (n - lockedTeamIds.length) extra teams.
   */
  lockedTeamIds?: string[]
}

export function TeamSetGrid({
  teams,
  selected,
  onChange,
  n,
  disabled,
  lockedTeamIds = [],
}: Props) {
  const [query, setQuery] = useState('')
  const lockedSet = new Set(lockedTeamIds)
  const set = new Set(selected)
  const userPicks = selected.filter((id) => !lockedSet.has(id))
  const userPicksMax = Math.max(0, n - lockedTeamIds.length)

  const filtered = teams.filter((t) => {
    if (!query) return true
    const q = query.toLowerCase()
    return t.name.toLowerCase().includes(q) || (t.fifaCode ?? '').toLowerCase().includes(q)
  })

  function toggle(id: string) {
    if (lockedSet.has(id)) return
    if (set.has(id)) {
      onChange(selected.filter((x) => x !== id))
    } else if (userPicks.length < userPicksMax) {
      onChange([...selected, id])
    }
  }

  function clearUserPicks() {
    onChange(selected.filter((id) => lockedSet.has(id)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {lockedTeamIds.length > 0
            ? `${lockedTeamIds.length} ya bloqueadas. Elige ${userPicksMax} más.`
            : 'Toca para seleccionar. Sin orden.'}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-sm font-semibold tabular-nums ${
              set.size === n ? 'text-success' : 'text-foreground'
            }`}
          >
            {set.size} / {n}
          </span>
          {userPicks.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearUserPicks}
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
          const isLocked = lockedSet.has(t.id)
          const isSelected = set.has(t.id)
          const atCap = !isSelected && userPicks.length >= userPicksMax
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              disabled={disabled || isLocked || atCap}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
                isLocked
                  ? 'border-primary/40 bg-primary/10 cursor-not-allowed'
                  : isSelected
                    ? 'border-primary bg-primary/10'
                    : atCap
                      ? 'border-border bg-card opacity-40 cursor-not-allowed'
                      : 'border-border bg-card hover:bg-muted/40'
              }`}
              title={isLocked ? 'Esta selección viene de tu Campeón / Subcampeón / Tercer lugar' : undefined}
            >
              <span className="text-base leading-none">{t.flagEmoji ?? '🏳️'}</span>
              <span className="flex-1 truncate font-medium">{t.name}</span>
              {isLocked ? (
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Lock className="h-2.5 w-2.5" />
                </span>
              ) : (
                isSelected && (
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
