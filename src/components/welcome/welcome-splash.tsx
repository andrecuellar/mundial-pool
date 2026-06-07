'use client'

import { useEffect, useState } from 'react'
import type { BoringMatchView } from '@/features/welcome/boring-matches'
import { bolivianCalendarDate } from '@/lib/format'
import { MatchCard } from './match-card'

type Props = {
  matches: BoringMatchView[]
  vapidPublicKey: string | null
}

const STORAGE_KEY = 'mp_splash_last_shown_v1'
const COUNTDOWN_SECONDS = 7

// Detecta si la app abrió en un contexto de "alta intención": TWA (APK
// Android) o PWA instalada (Add to Home Screen). En ambos casos el user
// ya hizo opt-in al producto (instaló el APK / la PWA), así que pedir
// permiso de notificaciones desde el splash es legítimo y Chrome no
// aplica el "quieter notification UI" que sí afecta a tabs web normales
// con bajo engagement.
function isInInstalledApp(): boolean {
  if (typeof window === 'undefined') return false
  // TWA: el wrapper setea referrer android-app://com.package.name
  if (document.referrer.startsWith('android-app://')) return true
  // PWA standalone (Chrome/Edge/Brave en desktop o Android): display-mode
  // = standalone cuando la PWA se abre desde el launcher.
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS PWA "Add to Home Screen": Safari setea navigator.standalone.
  if ((navigator as { standalone?: boolean }).standalone === true) return true
  return false
}

// Full-screen splash que aparece la PRIMERA vez que el usuario abre la app
// cada día (cold start del navegador o PWA). Cuenta regresiva visible de 7s
// arriba a la derecha. El user puede esperar (auto-dismiss al llegar a 0) o
// presionar el botón "Iniciar" abajo — Iniciar TAMBIÉN dispara la pedida del
// permiso de notificaciones (es el user gesture que Chrome/Android requiere
// para mostrar el prompt). Si ya se mostró hoy (localStorage con fecha BOT),
// no vuelve hasta el día siguiente.
export function WelcomeSplash({ matches, vapidPublicKey }: Props) {
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
    // Auto-dismiss NO pide el permiso porque no hay user gesture (el prompt
    // de Chrome fallaría silencioso). Solo el botón "Iniciar" lo dispara.
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
    // Disparamos el prompt automático en TWA o PWA instalada — ambos son
    // contextos de alta intención (el user instaló el producto). En browser
    // regular (tab normal) NO disparamos: Chrome aplica el "quieter UI" y
    // suele bloquear los pedidos automáticos para sitios nuevos sin
    // engagement. Ahí el opt-in se reserva para el banner PushOptIn (click
    // explícito en "Activar notificaciones" = high-intent gesture).
    if (isInInstalledApp()) {
      void askForNotifications(vapidPublicKey)
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
          es solo informativo. Tocarlo TAMBIÉN dispara el prompt nativo de
          notificaciones — el tap cuenta como user gesture que Chrome/Android
          requieren. */}
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

// Pide el permiso de notificaciones + se suscribe al Web Push si fue
// otorgado. Idéntico al patrón de PushOptIn pero invocado desde el splash
// con el user gesture del botón "Iniciar".
async function askForNotifications(vapidPublicKey: string | null): Promise<void> {
  if (typeof window === 'undefined') return
  if (!vapidPublicKey) return
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return
  }
  // Si ya fue denegado en una sesión previa, no podemos volver a pedir
  // — Chrome lo bloquea silencioso. El banner de PushOptIn explica al user
  // cómo activarlo manualmente.
  if (Notification.permission === 'denied') return

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const perm =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
    if (perm !== 'granted') return

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      })
    }
    const json = sub.toJSON()
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      }),
      keepalive: true,
    })
  } catch (e) {
    console.warn('push opt-in from splash failed', e)
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}
