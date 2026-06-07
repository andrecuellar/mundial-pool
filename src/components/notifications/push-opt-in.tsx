'use client'

import { track } from '@vercel/analytics'
import { Bell, BellOff, ExternalLink, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ensurePushSubscription, requestNotificationPermission } from '@/lib/notifications'

const DISMISS_KEY = 'mp:push-opt-in-dismissed'
const SILENT_BLOCK_KEY = 'mp_notif_silent_block_v1'
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

    // El splash puede haber detectado un silent-block y dejado un flag.
    // En ese caso el banner muestra la UI de recovery.
    try {
      if (window.localStorage.getItem(SILENT_BLOCK_KEY) === '1') {
        setState('silent_block')
        return
      }
    } catch {}

    const dismissed = window.localStorage.getItem(DISMISS_KEY)
    if (dismissed === '1') {
      setState('dismissed')
      return
    }

    if (Notification.permission === 'denied') {
      setState('denied')
    } else if (Notification.permission === 'granted') {
      setState('granted')
    } else {
      setState('prompt')
    }
  }, [vapidPublicKey])

  async function enable() {
    if (!vapidPublicKey) return
    setBusy(true)
    try {
      track('notification_prompt_shown', { context: 'banner' })
      const result = await requestNotificationPermission()
      if (result.kind === 'granted') {
        track('notification_permission_granted', { context: 'banner' })
        const ok = await ensurePushSubscription(vapidPublicKey)
        if (ok) {
          track('push_subscription_saved', { context: 'banner' })
          setState('granted')
          toast.success('Notificaciones activadas')
          try {
            window.localStorage.removeItem(SILENT_BLOCK_KEY)
          } catch {}
        } else {
          toast.error('No pudimos activar las notificaciones.')
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
    window.localStorage.setItem(DISMISS_KEY, '1')
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
