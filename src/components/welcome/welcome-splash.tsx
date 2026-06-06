'use client'

import { useEffect, useState } from 'react'
import type { BoringMatchView } from '@/features/welcome/boring-matches'
import { bolivianCalendarDate } from '@/lib/format'
import { MatchCard } from './match-card'

type Props = {
  matches: BoringMatchView[]
}

const STORAGE_KEY = 'mp_splash_last_shown_v1'
const COUNTDOWN_SECONDS = 7

// Full-screen splash que aparece la PRIMERA vez que el usuario abre la app
// cada día (cold start del navegador o PWA). Cuenta regresiva visible de 7s
// arriba a la derecha. El user puede esperar (auto-dismiss al llegar a 0) o
// presionar el botón "Iniciar" abajo. Si ya se mostró hoy (localStorage con
// fecha BOT), no vuelve hasta el día siguiente.
export function WelcomeSplash({ matches }: Props) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // El "día de hoy" se mide en hora boliviana, NO en la TZ del device.
    // Si el user viaja, el flag sigue alineado al calendario BOT.
    const today = bolivianCalendarDate()
    try {
      const last = window.localStorage.getItem(STORAGE_KEY)
      if (last === today) return
      window.localStorage.setItem(STORAGE_KEY, today)
    } catch {
      // localStorage bloqueado (ej. modo privado restrictivo): mostramos igual.
    }
    setVisible(true)

    // Tick por segundo para actualizar el contador visible.
    const tick = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    // Cuando se cumple el countdown, arrancamos el fade-out + unmount.
    const dismissTimer = window.setTimeout(
      () => setLeaving(true),
      COUNTDOWN_SECONDS * 1000,
    )
    const unmountTimer = window.setTimeout(
      () => setVisible(false),
      COUNTDOWN_SECONDS * 1000 + 500,
    )
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(dismissTimer)
      window.clearTimeout(unmountTimer)
    }
  }, [])

  if (!visible) return null

  function handleDismiss() {
    setLeaving(true)
  }

  return (
    <div
      role="dialog"
      aria-label="Bienvenida"
      className={`fixed inset-0 z-[80] bg-background/95 backdrop-blur-sm transition-opacity duration-500 ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* Contador arriba a la derecha. Tabular nums + ring pulsando para
          que el user sepa cuánto le falta sin tener que esperar a ciegas. */}
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <div className="grid h-12 w-12 place-items-center rounded-full border border-border bg-card/80 backdrop-blur">
          <span
            className="font-mono text-lg font-semibold tabular-nums text-foreground"
            aria-live="polite"
          >
            {secondsLeft}
          </span>
        </div>
      </div>

      <div className="flex h-full flex-col items-center justify-center px-6 pb-24 pt-16 sm:pt-20">
        <div className="mx-auto w-full max-w-md text-center">
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
        </div>
      </div>

      {/* Botón "Iniciar" pinned al pie. Es la acción explícita; el contador
          es solo informativo. Ambos terminan en el mismo dismiss. */}
      <div className="absolute inset-x-0 bottom-6 grid place-items-center sm:bottom-10">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          Iniciar
        </button>
      </div>
    </div>
  )
}
