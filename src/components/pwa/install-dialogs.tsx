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

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
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

export function AndroidInstallDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Instalar en Android</DialogTitle>
          <DialogDescription>3 pasos en Chrome, Edge o Brave:</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs font-semibold">
              1
            </span>
            <span>
              Toca el menú <span className="font-mono font-semibold text-foreground">⋮</span> (tres
              puntos verticales) en la esquina superior derecha del navegador.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs font-semibold">
              2
            </span>
            <span>
              Busca y toca <span className="font-medium text-foreground">"Instalar app"</span> o{' '}
              <span className="font-medium text-foreground">"Añadir a pantalla principal"</span>.
              Suele estar a la mitad del menú.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs font-semibold">
              3
            </span>
            <span>
              Confirma con <span className="font-medium text-foreground">"Instalar"</span>. La app
              queda en tu pantalla de inicio como cualquier otra y arranca sin la barra del
              navegador.
            </span>
          </li>
        </ol>
        <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground leading-relaxed">
          💡{' '}
          <span className="font-medium text-foreground">
            ¿Ves "Abrir mundial-pool" en lugar de "Instalar"?
          </span>{' '}
          Ya tienes la app instalada. Tócala y se abre directamente — listo.
        </p>
        <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">¿No ves "Instalar" ni "Abrir"?</span>{' '}
          Algunos navegadores (Firefox, ciertos custom browsers) solo ofrecen{' '}
          <span className="font-medium text-foreground">"Añadir a pantalla principal"</span> —
          funciona casi igual. Si no aparece ninguna, prueba con Chrome o Edge.
        </p>
        <p className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">¿Querés la app nativa con notificaciones?</span>{' '}
          Bajá el .apk desde{' '}
          <a href="/instalar" className="font-medium text-accent underline">
            mundial-pool.vercel.app/instalar
          </a>
          .
        </p>
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
              de direcciones. Vas a ver un ícono pequeño de instalación (una pantalla con una flecha
              hacia abajo). Hazle clic.
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
        <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground leading-relaxed">
          💡{' '}
          <span className="font-medium text-foreground">
            ¿En el menú ves "Abrir mundial-pool" en lugar de "Instalar"?
          </span>{' '}
          Ya tienes la app instalada. Hazle clic ahí y se abre directamente — listo.
        </p>
        <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">
            ¿No ves el ícono ni "Instalar" ni "Abrir"?
          </span>{' '}
          Puede ser que tu navegador no soporte la instalación (Firefox de escritorio no la trae).
          Prueba con Chrome o Edge.
        </p>
        <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full">
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  )
}
