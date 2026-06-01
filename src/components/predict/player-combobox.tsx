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
  /**
   * Optional list of name patterns to surface at the top of the dropdown as
   * "Sugerencias" when no query is typed. Each pattern is matched against the
   * normalized full name (case + accent insensitive, substring). First match
   * per pattern wins; suggested players are then excluded from the main list
   * to avoid duplication.
   */
  suggestedNamePatterns?: string[]
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
  suggestedNamePatterns,
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

  const suggestions = useMemo(() => {
    if (!suggestedNamePatterns || suggestedNamePatterns.length === 0) return []
    const seen = new Set<string>()
    const out: PlayerOption[] = []
    for (const pat of suggestedNamePatterns) {
      const normPat = normalize(pat)
      if (!normPat) continue
      const match = eligible.find(
        (p) => !seen.has(p.id) && normalize(p.fullName).includes(normPat),
      )
      if (match) {
        seen.add(match.id)
        out.push(match)
      }
    }
    return out
  }, [eligible, suggestedNamePatterns])

  const queryNorm = normalize(query)
  const trimmedQuery = query.trim()
  const exactMatch = useMemo(
    () => eligible.find((p) => normalize(p.fullName) === queryNorm),
    [eligible, queryNorm],
  )
  const showCustomOption = trimmedQuery.length >= 2 && !exactMatch && trimmedQuery !== value
  const showSuggestions = !queryNorm && suggestions.length > 0

  // shadcn cmdk default filter is fuzzy; we cap suggestions for perf with 1200+ rows.
  const filtered = useMemo(() => {
    const suggestedIds = new Set(suggestions.map((p) => p.id))
    if (!queryNorm) {
      // Push the suggested players out of the main list so they don't appear
      // twice when the user hasn't typed anything yet.
      return eligible.filter((p) => !suggestedIds.has(p.id)).slice(0, 60)
    }
    return eligible
      .filter(
        (p) =>
          normalize(p.fullName).includes(queryNorm) || normalize(p.teamName).includes(queryNorm),
      )
      .slice(0, 60)
  }, [eligible, queryNorm, suggestions])

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
            {showSuggestions && (
              <CommandGroup heading="Sugerencias">
                {suggestions.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => {
                      onChange(p.fullName)
                      setOpen(false)
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-base leading-none">{p.teamFlag ?? '🏳️'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{p.fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.teamName}</div>
                    </div>
                    {value === p.fullName && (
                      <Check className="ml-2 h-4 w-4 text-primary shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {filtered.length > 0 && (
              <CommandGroup
                heading={
                  query
                    ? `Coincidencias (${filtered.length})`
                    : showSuggestions
                      ? 'Otros jugadores'
                      : 'Jugadores'
                }
              >
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
                      <div className="text-xs text-muted-foreground truncate">{p.teamName}</div>
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
