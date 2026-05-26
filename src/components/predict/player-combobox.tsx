'use client'

import { Check, ChevronsUpDown, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import type { PlayerOption } from '@/features/predictions/queries'

type Props = {
  players: PlayerOption[]
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  /** If set, only players born on/after this ISO date are shown. */
  minDob?: string
  /** If set, only players whose position matches (case-insensitive) are shown. */
  position?: string
  placeholder?: string
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function PlayerComboBox({
  players,
  value,
  onChange,
  disabled,
  minDob,
  position,
  placeholder = 'Buscar jugador o escribir nombre…',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const eligible = useMemo(() => {
    const posUpper = position?.toUpperCase()
    return players.filter((p) => {
      if (minDob && (!p.dateOfBirth || p.dateOfBirth < minDob)) return false
      if (posUpper && (p.position ?? '').toUpperCase() !== posUpper) return false
      return true
    })
  }, [players, minDob, position])

  const queryNorm = normalize(query)
  const trimmedQuery = query.trim()
  const exactMatch = useMemo(
    () => eligible.find((p) => normalize(p.fullName) === queryNorm),
    [eligible, queryNorm],
  )
  const showCustomOption = trimmedQuery.length >= 2 && !exactMatch && trimmedQuery !== value

  // shadcn cmdk default filter is fuzzy; we cap suggestions for perf with 1200+ rows.
  const filtered = useMemo(() => {
    if (!queryNorm) return eligible.slice(0, 60)
    return eligible
      .filter(
        (p) =>
          normalize(p.fullName).includes(queryNorm) || normalize(p.teamName).includes(queryNorm),
      )
      .slice(0, 60)
  }, [eligible, queryNorm])

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
          {value ? (
            <span className="truncate font-medium">{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={placeholder} />
          <CommandList>
            {showCustomOption && (
              <CommandGroup heading="Personalizado">
                <CommandItem
                  value={`custom:${trimmedQuery}`}
                  onSelect={() => {
                    onChange(trimmedQuery)
                    setOpen(false)
                  }}
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium">Usar: {trimmedQuery}</span>
                </CommandItem>
              </CommandGroup>
            )}
            {filtered.length === 0 && !showCustomOption && (
              <CommandEmpty>
                {minDob ? 'Sin jugadores menores de 21 con ese nombre.' : 'Sin coincidencias.'}
              </CommandEmpty>
            )}
            {filtered.length > 0 && (
              <CommandGroup heading={query ? `Coincidencias (${filtered.length})` : 'Jugadores'}>
                {filtered.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => {
                      onChange(p.fullName)
                      setOpen(false)
                    }}
                  >
                    <span className="text-base leading-none">{p.teamFlag ?? '🏳️'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{p.fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.teamName}
                      </div>
                    </div>
                    {value === p.fullName && (
                      <Check className="ml-2 h-4 w-4 text-primary shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
