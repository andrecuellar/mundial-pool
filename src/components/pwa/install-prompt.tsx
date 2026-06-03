'use client'

import { track } from '@vercel/analytics'
import { Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  type BeforeInstallPromptEvent,
  DesktopInstallDialog,
  IosInstallDialog,
  isIos,
  isStandalone,
} from './install-dialogs'

const DISMISS_KEY = 'mp:pwa-prompt-dismissed-until'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000 // 7 días — antes 30 días era demasiado agresivo
const SHOW_AFTER_MS = 5 * 1000 // 5 segundos — antes 30s era invisible para muchos

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showSnack, setShowSnack] = useState(false)
  const [iosDialogOpen, setIosDialogOpen] = useState(false)
  const [desktopDialogOpen, setDesktopDialogOpen] = useState(false)

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
      // Si el evento llega después del timeout, sincronizamos el estado para
      // que el botón pueda usarlo en vez de caer al dialog manual.
      if (mounted) setEvent(savedEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const timer = setTimeout(() => {
      if (!mounted) return
      if (savedEvent) setEvent(savedEvent)
      // Ahora mostramos el banner siempre que no esté instalado / no esté
      // descartado. Si no tenemos el evento al final, el botón Instalar abre
      // el dialog con instrucciones (similar a iOS Safari).
      setShowSnack(true)
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
      track('pwa_install_clicked', { platform: 'ios' })
      setIosDialogOpen(true)
      return
    }
    if (event) {
      track('pwa_install_clicked', { platform: 'web' })
      await event.prompt()
      const { outcome } = await event.userChoice
      if (outcome === 'accepted') {
        track('pwa_installed', { platform: 'web' })
        setShowSnack(false)
        // Don't store dismissal — they installed; the standalone check will
        // suppress next time.
      } else {
        track('pwa_install_dismissed', { platform: 'web' })
        dismiss()
      }
      return
    }
    track('pwa_install_clicked', { platform: 'desktop-fallback' })
    // Fallback desktop: el navegador no nos dio el evento (ya lo manejó
    // antes, otro browser, etc.) → mostramos instrucciones manuales.
    setDesktopDialogOpen(true)
  }

  const buttonLabel = isIos() ? 'Ver cómo' : event ? 'Instalar' : 'Cómo instalar'

  const content = (
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
            {buttonLabel}
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
  )

  return (
    <>
      {showSnack && (
        <>
          <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-border bg-card p-4 shadow-lg sm:hidden">
            {content}
          </div>
          <div className="hidden rounded-xl border border-border bg-card p-4 shadow-lg sm:block">
            {content}
          </div>
        </>
      )}

      <IosInstallDialog open={iosDialogOpen} onOpenChange={setIosDialogOpen} />
      <DesktopInstallDialog open={desktopDialogOpen} onOpenChange={setDesktopDialogOpen} />
    </>
  )
}
