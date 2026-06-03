'use client'

import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error iOS-only legacy field
    window.navigator.standalone === true
  )
}

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IosInstallDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full">
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  )
}

export function DesktopInstallDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full">
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  )
}
