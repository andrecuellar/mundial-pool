'use client'

import { Bell, BellOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const DISMISS_KEY = 'mp:push-opt-in-dismissed'

type State = 'unknown' | 'unsupported' | 'denied' | 'granted' | 'prompt' | 'dismissed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

type Props = {
  vapidPublicKey: string | null
}

export function PushOptIn({ vapidPublicKey }: Props) {
  const [state, setState] = useState<State>('unknown')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported')
      return
    }
    if (!vapidPublicKey) {
      setState('unsupported')
      return
    }

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
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        if (perm === 'denied') setState('denied')
        setBusy(false)
        return
      }

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        })
      }

      const json = sub.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      })

      if (!res.ok) {
        toast.error('No pudimos activar las notificaciones.')
      } else {
        setState('granted')
        toast.success('Notificaciones activadas')
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

  if (state !== 'prompt') return null

  return (
    <Card className="mb-4 border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Activa las notificaciones del Mundial</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            Recibe avisos cuando se acerque el cierre, cuando se resuelvan resultados y cuando
            ganes puntos en cualquiera de tus grupos.
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
