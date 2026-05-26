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

type Team = { id: string; name: string; flagEmoji: string | null; fifaCode: string | null }

type Props = {
  teams: Team[]
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}

export function TeamComboBox({ teams, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const selected = teams.find((t) => t.id === value)

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
            <span className="flex items-center gap-2">
              <span className="text-base leading-none">{selected.flagEmoji ?? '🏳️'}</span>
              <span className="font-medium">{selected.name}</span>
              {selected.fifaCode && (
                <span className="font-mono text-xs text-muted-foreground">{selected.fifaCode}</span>
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
              {teams.map((t) => (
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
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {t.fifaCode}
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
