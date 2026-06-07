'use client'

import { track } from '@vercel/analytics'
import { useEffect, useState } from 'react'
import type { BoringMatchView } from '@/features/welcome/boring-matches'
import { bolivianCalendarDate } from '@/lib/format'
import { ensurePushSubscription, requestNotificationPermission } from '@/lib/notifications'
import { MatchCard } from './match-card'

type Props = {
  matches: BoringMatchView[]
  vapidPublicKey: string | null
}

const STORAGE_KEY = 'mp_splash_last_shown_v1'
const SILENT_BLOCK_KEY = 'mp_notif_silent_block_v1'
const COUNTDOWN_SECONDS = 7

// Detecta si la app abrió en un contexto de "alta intención": TWA (APK
// Android) o PWA instalada (Add to Home Screen). En ambos casos el user
// ya hizo opt-in al producto (instaló el APK / la PWA), así que pedir
// permiso de notificaciones desde el splash es legítimo y Chrome no
// aplica el "quieter notification UI" que sí afecta a tabs web normales
// con bajo engagement.
function isInInstalledApp(): boolean {
  if (typeof window === 'undefined') return false
  if (document.referrer.startsWith('android-app://')) return true
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  if ((navigator as { standalone?: boolean }).standalone === true) return true
  return false
}

export function WelcomeSplash({ matches, vapidPublicKey }: Props) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const today = bolivianCalendarDate()
    try {
      const last = window.localStorage.getItem(STORAGE_KEY)
      if (last === today) return
      window.localStorage.setItem(STORAGE_KEY, today)
    } catch {
      // localStorage bloqueado: mostramos igual.
    }
    setVisible(true)

    const tick = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
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

  function handleIniciar() {
    if (isInInstalledApp()) {
      void askForNotifications(vapidPublicKey, 'splash')
    }
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

      <div className="absolute inset-x-0 bottom-6 grid place-items-center sm:bottom-10">
        <button
          type="button"
          onClick={handleIniciar}
          className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          Iniciar
        </button>
      </div>
    </div>
  )
}

async function askForNotifications(
  vapidPublicKey: string | null,
  context: 'splash' | 'banner',
): Promise<void> {
  if (!vapidPublicKey) return
  track('notification_prompt_shown', { context })
  const result = await requestNotificationPermission()
  if (result.kind === 'granted') {
    track('notification_permission_granted', { context })
    const ok = await ensurePushSubscription(vapidPublicKey)
    if (ok) track('push_subscription_saved', { context })
    // Limpiar flag de silent-block si lo había.
    try {
      window.localStorage.removeItem(SILENT_BLOCK_KEY)
    } catch {}
  } else if (result.kind === 'denied') {
    track('notification_permission_denied', { context })
  } else if (result.kind === 'silent_block') {
    track('notification_permission_silent_blocked', { context })
    // Persistimos el flag para que el banner PushOptIn lo muestre.
    try {
      window.localStorage.setItem(SILENT_BLOCK_KEY, '1')
    } catch {}
  }
}
