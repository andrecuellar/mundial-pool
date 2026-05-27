'use client'

import { Check, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Team = {
  id: string
  name: string
  flagEmoji: string | null
  fifaCode: string | null
  fifaRanking?: number | null
}

type Props = {
  teams: Team[]
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
  /** When true, displays each team's FIFA ranking ("FIFA #15" / "+50"). */
  showRanking?: boolean
  /**
   * IDs to remove from the list entirely. Used to prevent picking the same
   * team across mutually exclusive podium spots (champion / runner-up / third
   * place). The currently selected team (`value`) is always kept visible even
   * if it appears here, otherwise the user can't see what they had picked.
   */
  excludeIds?: string[]
}

function rankingLabel(r: number | null | undefined): string {
  if (r == null) return '+50'
  return `#${r}`
}

export function TeamComboBox({
  teams,
  value,
  onChange,
  disabled,
  showRanking,
  excludeIds,
}: Props) {
  const [open, setOpen] = useState(false)
  const selected = teams.find((t) => t.id === value)

  const excludeSet = excludeIds && excludeIds.length > 0 ? new Set(excludeIds) : null
  const filtered = excludeSet
    ? teams.filter((t) => t.id === value || !excludeSet.has(t.id))
    : teams

  const sortedTeams = showRanking
    ? [...filtered].sort((a, b) => {
        const ra = a.fifaRanking ?? 999
        const rb = b.fifaRanking ?? 999
        if (ra !== rb) return ra - rb
        return a.name.localeCompare(b.name, 'es')
      })
    : filtered

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal h-11"
        >
          {selected ? (
            <span className="flex w-full items-center gap-2">
              <span className="text-base leading-none">{selected.flagEmoji ?? '🏳️'}</span>
              <span className="font-medium">{selected.name}</span>
              {selected.fifaCode && (
                <span className="font-mono text-xs text-muted-foreground">{selected.fifaCode}</span>
              )}
              {showRanking && (
                <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">
                  FIFA {rankingLabel(selected.fifaRanking)}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">Buscar selección…</span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar selección…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {sortedTeams.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.name} ${t.fifaCode ?? ''}`}
                  onSelect={() => {
                    onChange(t.id === value ? null : t.id)
                    setOpen(false)
                  }}
                >
                  <span className="text-base leading-none">{t.flagEmoji ?? '🏳️'}</span>
                  <span className="font-medium">{t.name}</span>
                  {t.fifaCode && (
                    <span className="font-mono text-xs text-muted-foreground">{t.fifaCode}</span>
                  )}
                  {showRanking && (
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">
                      FIFA {rankingLabel(t.fifaRanking)}
                    </span>
                  )}
                  <Check
                    className={cn(
                      'ml-2 h-4 w-4 text-primary',
                      t.id === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
