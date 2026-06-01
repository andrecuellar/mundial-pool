'use client'

import { Download, Share2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const DISMISS_KEY = 'mp:pwa-prompt-dismissed-until'
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000 // 30 días
const SHOW_AFTER_MS = 30 * 1000 // 30 segundos de uso

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error iOS-only legacy field
    window.navigator.standalone === true
  )
}

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showSnack, setShowSnack] = useState(false)
  const [showIos, setShowIos] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) return

    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (raw) {
      const until = Number.parseInt(raw, 10)
      if (Number.isFinite(until) && until > Date.now()) return
    }

    let mounted = true
    let savedEvent: BeforeInstallPromptEvent | null = null

    const handler = (e: Event) => {
      e.preventDefault()
      savedEvent = e as BeforeInstallPromptEvent
    }
    window.addEventListener('beforeinstallprompt', handler)

    const timer = setTimeout(() => {
      if (!mounted) return
      if (savedEvent) {
        setEvent(savedEvent)
        setShowSnack(true)
      } else if (isIos()) {
        setShowSnack(true)
      }
    }, SHOW_AFTER_MS)

    return () => {
      mounted = false
      clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  function dismiss() {
    setShowSnack(false)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS))
    }
  }

  async function install() {
    if (isIos()) {
      setShowIos(true)
      return
    }
    if (!event) return
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') {
      setShowSnack(false)
      // Don't store dismissal — they installed; the standalone check will
      // suppress next time.
    } else {
      dismiss()
    }
  }

  return (
    <>
      {showSnack && (
        <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-border bg-card p-4 shadow-lg sm:bottom-auto sm:left-4 sm:top-20 sm:max-w-xs sm:translate-x-0">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Download className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Instala mundial-pool</p>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                Acceso directo desde tu pantalla de inicio y notificaciones del Mundial.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={install}>
                  {isIos() ? 'Ver cómo' : 'Instalar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>
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
        </div>
      )}

      <Dialog open={showIos} onOpenChange={setShowIos}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Instalar en iPhone</DialogTitle>
            <DialogDescription>3 pasos rápidos en Safari:</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs font-semibold">
                1
              </span>
              <span>
                Toca el botón <Share2 className="inline h-3.5 w-3.5" /> "Compartir" en la barra de
                Safari (abajo en iPhone, arriba en iPad).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs font-semibold">
                2
              </span>
              <span>Desplázate y elige "Añadir a Inicio".</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs font-semibold">
                3
              </span>
              <span>Toca "Añadir" en la esquina superior derecha. ¡Listo!</span>
            </li>
          </ol>
          <Button onClick={() => setShowIos(false)} variant="outline" className="w-full">
            Cerrar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
