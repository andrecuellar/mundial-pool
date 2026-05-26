'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Render a stable placeholder during SSR / before hydration so the markup
  // matches the server output and React doesn't warn about mismatches.
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Cambiar tema">
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  const isSystem = theme === 'system'
  const mainIcon = isSystem ? (
    <Monitor className="h-4 w-4" />
  ) : theme === 'light' ? (
    <Sun className="h-4 w-4" />
  ) : (
    <Moon className="h-4 w-4" />
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Tema actual: ${theme}`}
        >
          {mainIcon}
          {isSystem && (
            <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 grid h-3 w-3 place-items-center rounded-full bg-background ring-1 ring-border">
              {resolvedTheme === 'light' ? (
                <Sun className="h-2 w-2" strokeWidth={2.4} />
              ) : (
                <Moon className="h-2 w-2" strokeWidth={2.4} />
              )}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={() => setTheme('light')}>
          <Sun className="h-4 w-4" />
          Claro
          {theme === 'light' && (
            <span className="ml-auto text-[10px] text-muted-foreground">●</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('dark')}>
          <Moon className="h-4 w-4" />
          Oscuro
          {theme === 'dark' && (
            <span className="ml-auto text-[10px] text-muted-foreground">●</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('system')}>
          <Monitor className="h-4 w-4" />
          Sistema
          {isSystem && (
            <span className="ml-auto text-[10px] text-muted-foreground">●</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
