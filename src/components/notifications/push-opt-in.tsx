'use client'

import { track } from '@vercel/analytics'
import { Bell, BellOff, ExternalLink, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { bolivianCalendarDate } from '@/lib/format'
import { ensurePushSubscription, requestNotificationPermission } from '@/lib/notifications'

// El dismiss persiste solo por el día BOT actual. Al día siguiente (en
// calendario boliviano) el banner vuelve a aparecer — así no perdemos
// al user que dijo "Más tarde" en algún momento del Mundial.
const DISMISS_KEY = 'mp:push-opt-in-dismissed-on'
const SILENT_BLOCK_KEY = 'mp_notif_silent_block_v1'
// Flag que recuerda que el user YA dijo "sí" en algún momento. En mobile
// (Chrome Android, in-app browsers, PWA standalone) Notification.permission
// a veces se reporta como 'default' después de un reload aunque el user
// ya lo haya aceptado. Sin este flag, el banner vuelve a aparecer una y
// otra vez. Con este flag, una vez que el user dijo "sí" en este device,
// nunca más mostramos el banner aunque el browser olvide el estado.
const GRANTED_KEY = 'mp:push-granted-locally'
const TWA_PACKAGE = 'app.andrecuellar.mundialpool.twa'

type State =
  | 'unknown'
  | 'unsupported'
  | 'denied'
  | 'granted'
  | 'prompt'
  | 'dismissed'
  | 'silent_block'

function isInTwa(): boolean {
  if (typeof document === 'undefined') return false
  return document.referrer.startsWith('android-app://')
}

// Intent URI para abrir Settings → mundial-pool → Notifications en el TWA.
// Solo Android lo intercepta correctamente (Chrome en TWA + WebView).
const ANDROID_NOTIF_SETTINGS_INTENT = `intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;S.android.provider.extra.APP_PACKAGE=${TWA_PACKAGE};end`

type Props = {
  vapidPublicKey: string | null
}

export function PushOptIn({ vapidPublicKey }: Props) {
  const [state, setState] = useState<State>('unknown')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setState('unsupported')
      return
    }
    if (!vapidPublicKey) {
      setState('unsupported')
      return
    }

    let cancelled = false
    ;(async () => {
      // ORDEN IMPORTANTE: chequeamos el estado real del browser primero.
      // Si granted → nunca mostramos banner. Si denied → mostramos UI de
      // recovery con instrucciones.
      if (Notification.permission === 'granted') {
        if (cancelled) return
        setState('granted')
        try {
          window.localStorage.removeItem(SILENT_BLOCK_KEY)
          window.localStorage.setItem(GRANTED_KEY, '1')
        } catch {}
        void ensurePushSubscription(vapidPublicKey)
        return
      }
      if (Notification.permission === 'denied') {
        if (cancelled) return
        setState('denied')
        return
      }

      // permission === 'default'. Antes confiábamos ciegamente en el flag
      // GRANTED_KEY de localStorage, pero eso ocultaba el banner cuando
      // Chrome revoca el permiso silenciosamente (Quieter UI / abuse
      // detection) sin cambiar permission a 'denied'. Ahora chequeamos si
      // existe una suscripción REAL en el SW: si sí, granted de verdad;
      // si no, el flag stale lo limpiamos y mostramos el banner para que
      // el user pueda re-permitir.
      let hasActiveSub = false
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) {
          const sub = await reg.pushManager.getSubscription()
          hasActiveSub = !!sub
        }
      } catch {}

      if (cancelled) return

      if (hasActiveSub) {
        // Suscripción válida del browser → granted de verdad (Chrome a
        // veces reporta default después de reload aunque haya sub).
        setState('granted')
        try {
          window.localStorage.setItem(GRANTED_KEY, '1')
        } catch {}
        return
      }

      // No hay suscripción activa: el flag GRANTED_KEY (si existía) es
      // basura — el browser revocó. Lo limpiamos y caemos al flow normal
      // de mostrar el banner.
      try {
        window.localStorage.removeItem(GRANTED_KEY)
      } catch {}

      try {
        if (window.localStorage.getItem(SILENT_BLOCK_KEY) === '1') {
          setState('silent_block')
          return
        }
      } catch {}

      // El dismiss es per-día: si lo cerró HOY (BOT), respetamos. Si fue
      // ayer o antes, mostramos el banner igual.
      try {
        const dismissedOn = window.localStorage.getItem(DISMISS_KEY)
        if (dismissedOn && dismissedOn === bolivianCalendarDate()) {
          setState('dismissed')
          return
        }
      } catch {}

      setState('prompt')
    })()
    return () => {
      cancelled = true
    }
  }, [vapidPublicKey])

  async function enable() {
    if (!vapidPublicKey) return
    setBusy(true)
    try {
      track('notification_prompt_shown', { context: 'banner' })
      const result = await requestNotificationPermission()
      if (result.kind === 'granted') {
        // CRÍTICO: el user dijo que sí, NUNCA volvemos a mostrar el banner.
        // Aunque la suscripción al backend falle (red caída, 500, lo que
        // sea), no obligamos a re-aceptar — eso fue el bug que generaba el
        // loop infinito de "activa las notificaciones".
        setState('granted')
        try {
          window.localStorage.removeItem(SILENT_BLOCK_KEY)
          window.localStorage.setItem(GRANTED_KEY, '1')
        } catch {}
        track('notification_permission_granted', { context: 'banner' })
        const ok = await ensurePushSubscription(vapidPublicKey)
        if (ok) {
          track('push_subscription_saved', { context: 'banner' })
          toast.success('Notificaciones activadas')
        } else {
          toast.error('Activadas, pero hubo un problema guardando. Recargá la página.')
        }
      } else if (result.kind === 'denied') {
        track('notification_permission_denied', { context: 'banner' })
        setState('denied')
      } else if (result.kind === 'silent_block') {
        track('notification_permission_silent_blocked', { context: 'banner' })
        try {
          window.localStorage.setItem(SILENT_BLOCK_KEY, '1')
        } catch {}
        setState('silent_block')
      }
    } catch (e) {
      console.error('push opt-in failed', e)
      toast.error('No pudimos activar las notificaciones.')
    } finally {
      setBusy(false)
    }
  }

  function dismiss() {
    try {
      // Guardamos la fecha BOT del dismiss. Al día siguiente el banner
      // vuelve a aparecer aunque el user lo haya cerrado.
      window.localStorage.setItem(DISMISS_KEY, bolivianCalendarDate())
    } catch {}
    setState('dismissed')
  }

  if (state === 'silent_block') {
    return (
      <Card className="border-warning/40 p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning">
            <BellOff className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Tu navegador bloqueó el aviso</p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Chrome decidió no mostrarte el prompt automático (le pasa a sitios nuevos). Para
              activar las notificaciones igual:
            </p>
            <ol className="mt-2 ml-4 list-decimal space-y-0.5 text-xs text-muted-foreground leading-relaxed">
              <li>Toca el ícono de candado/configuración a la izquierda de la URL.</li>
              <li>Busca "Notificaciones" y elige "Permitir".</li>
              <li>Recarga la página.</li>
            </ol>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={enable} disabled={busy}>
                {busy ? 'Probando…' : 'Intentar de nuevo'}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                <X className="h-3.5 w-3.5" />
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  if (state === 'denied') {
    const inTwa = isInTwa()
    return (
      <Card className="border-warning/30 p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning">
            <BellOff className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Notificaciones bloqueadas</p>
            {inTwa ? (
              <>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Las tienes apagadas para esta app en Android. Para activarlas, abre los ajustes
                  de la app y prende "Notificaciones".
                </p>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm">
                    <a href={ANDROID_NOTIF_SETTINGS_INTENT}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir ajustes
                    </a>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={dismiss}>
                    <X className="h-3.5 w-3.5" />
                    Cerrar
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                Las notificaciones están desactivadas para este sitio. Para activarlas, toca el
                candado/ícono junto a la URL, busca "Notificaciones" y elige "Permitir". Después
                recarga la página.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Cerrar"
            className="shrink-0 grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </Card>
    )
  }

  if (state !== 'prompt') return null

  return (
    <Card className="border-primary/30 p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Activa las notificaciones del Mundial</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            Recibe avisos cuando se acerque el cierre, cuando se confirme tu aporte al pozo, y
            cuando ganes puntos en cualquiera de tus grupos.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={enable} disabled={busy}>
              {busy ? 'Activando…' : 'Activar notificaciones'}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              <BellOff className="h-3.5 w-3.5" />
              Más tarde
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          className="shrink-0 grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  )
}
