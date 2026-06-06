'use client'

import { useEffect, useState } from 'react'
import type { BoringMatchView } from '@/features/welcome/boring-matches'
import { MatchCard } from './match-card'

type Props = {
  matches: BoringMatchView[]
}

const STORAGE_KEY = 'mp_splash_last_shown_v1'

// Full-screen splash que aparece la PRIMERA vez que el usuario abre la app
// cada día (cold start del navegador o PWA). Auto-dismiss a 3.5s, tap para
// skip. Si ya se mostró hoy (localStorage con fecha YYYY-MM-DD), no vuelve.
export function WelcomeSplash({ matches }: Props) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const today = new Date().toLocaleDateString('en-CA') // "2026-06-06"
    try {
      const last = window.localStorage.getItem(STORAGE_KEY)
      if (last === today) return
      window.localStorage.setItem(STORAGE_KEY, today)
    } catch {
      // localStorage bloqueado (ej. modo privado restrictivo): mostramos igual.
    }
    setVisible(true)
    const dismissTimer = window.setTimeout(() => setLeaving(true), 3500)
    const unmountTimer = window.setTimeout(() => setVisible(false), 4000)
    return () => {
      window.clearTimeout(dismissTimer)
      window.clearTimeout(unmountTimer)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Bienvenida"
      onClick={() => setLeaving(true)}
      className={`fixed inset-0 z-[80] grid place-items-center bg-background/95 backdrop-blur-sm transition-opacity duration-500 ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="mx-auto w-full max-w-md px-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          ¿Quién quiere predecir esto?{' '}
          <span className="animate-chef-kiss inline-block" aria-label="chef's kiss">
            🤌🏽
          </span>
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Aquí solo predices lo que importa.
        </p>

        <div className="mt-6 space-y-2.5">
          {matches.map((m, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: lista estática
              key={i}
              className="mp-card-fly-in"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <div
                className="mp-card-drift"
                style={{ animationDelay: `${600 + i * 120}ms` }}
              >
                <MatchCard {...m} />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Toca en cualquier lugar para entrar
        </p>
      </div>
    </div>
  )
}
