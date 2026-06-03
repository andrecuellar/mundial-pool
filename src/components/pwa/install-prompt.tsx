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
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000 // 7 días — antes 30 días era demasiado agresivo
const SHOW_AFTER_MS = 5 * 1000 // 5 segundos — antes 30s era invisible para muchos

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
      setIosDialogOpen(true)
      return
    }
    if (event) {
      await event.prompt()
      const { outcome } = await event.userChoice
      if (outcome === 'accepted') {
        setShowSnack(false)
        // Don't store dismissal — they installed; the standalone check will
        // suppress next time.
      } else {
        dismiss()
      }
      return
    }
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

      <Dialog open={iosDialogOpen} onOpenChange={setIosDialogOpen}>
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
          <Button onClick={() => setIosDialogOpen(false)} variant="outline" className="w-full">
            Cerrar
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={desktopDialogOpen} onOpenChange={setDesktopDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Instalar en tu computadora</DialogTitle>
            <DialogDescription>
              El navegador ya tiene un botón de instalación; te explicamos dónde encontrarlo.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs font-semibold">
                1
              </span>
              <span>
                En <span className="font-medium text-foreground">Chrome</span> o{' '}
                <span className="font-medium text-foreground">Edge</span>: mira al final de la barra
                de direcciones. Vas a ver un ícono pequeño de instalación (una pantalla con una
                flecha hacia abajo). Hazle clic.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs font-semibold">
                2
              </span>
              <span>
                Si no ves el ícono, abre el menú del navegador (⋮ arriba a la derecha) y elige{' '}
                <span className="font-medium text-foreground">"Instalar mundial-pool"</span> o{' '}
                <span className="font-medium text-foreground">
                  "Aplicaciones → Instalar este sitio"
                </span>
                .
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs font-semibold">
                3
              </span>
              <span>
                Confirma con "Instalar". La app queda accesible desde el escritorio y la barra de
                tareas, y arranca sin las pestañas del navegador.
              </span>
            </li>
          </ol>
          <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">¿No ves el ícono ni la opción?</span>{' '}
            Puede ser que tu navegador no soporte la instalación (por ejemplo, Firefox de escritorio
            no la trae), o que la app ya esté instalada. Si ya la instalaste antes, búscala en tus
            aplicaciones.
          </p>
          <Button onClick={() => setDesktopDialogOpen(false)} variant="outline" className="w-full">
            Cerrar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
