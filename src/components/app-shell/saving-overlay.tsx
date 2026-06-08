'use client'

import { CheckCircle2, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  phase: 'idle' | 'saving' | 'success'
  icon: LucideIcon
  savingTitle: string
  savingSubtitle?: string
  successTitle?: string
  successSubtitle?: string
  /**
   * Optional content rendered below the success subtitle. Use for action
   * buttons like "Compartir como imagen" or "Ver comprobante" that should
   * appear after the green check animation. Wrapped in its own fade-in so
   * it lands after the headline, not at the same time.
   */
  successActions?: ReactNode
  /**
   * If true, the overlay container fades out — useful when triggering a
   * route navigation manually so the success state doesn't get abruptly
   * cut by the page swap.
   */
  leaving?: boolean
}

// Full-screen overlay with two visible phases — 'saving' shows the supplied
// icon inside a pulsing trophy-style ring stack, 'success' shows a green
// checkmark with a quick scale-in. Idle = unmounted.
//
// Shared across submission flows where the server action runs into a route
// transition (predict → comprobante, new group → group dashboard, etc.) so the
// app never feels frozen while data lands and the next page hydrates.
export function SavingOverlay({
  phase,
  icon: Icon,
  savingTitle,
  savingSubtitle,
  successTitle = '¡Listo!',
  successSubtitle,
  successActions,
  leaving = false,
}: Props) {
  if (phase === 'idle') return null

  return (
    <div
      role="status"
      aria-live="polite"
      // No fade-in: the overlay needs to feel instant so the user knows the
      // click registered. La salida sí se anima (leaving) para que la
      // navegación al comprobante / siguiente ruta se sienta continua.
      className={`fixed inset-0 z-[70] grid place-items-center bg-background/95 backdrop-blur-md transition-opacity duration-400 ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        {phase === 'saving' ? (
          <>
            <div className="relative grid h-32 w-32 place-items-center">
              <span
                aria-hidden
                className="absolute inset-0 rounded-full border-2 border-primary/40 mp-pulse-ring"
                style={{ animationDelay: '0ms' }}
              />
              <span
                aria-hidden
                className="absolute inset-0 rounded-full border-2 border-primary/30 mp-pulse-ring"
                style={{ animationDelay: '500ms' }}
              />
              <span
                aria-hidden
                className="absolute inset-0 rounded-full border-2 border-primary/20 mp-pulse-ring"
                style={{ animationDelay: '1000ms' }}
              />
              <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-9 w-9 mp-trophy-spin" aria-hidden />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-lg font-semibold tracking-tight">
                {savingTitle}
                <span className="mp-ellipsis" aria-hidden />
              </p>
              {savingSubtitle && <p className="text-sm text-muted-foreground">{savingSubtitle}</p>}
            </div>
          </>
        ) : (
          <>
            <div className="relative grid h-32 w-32 place-items-center">
              <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-accent/15 animate-ping"
              />
              <div className="grid h-24 w-24 place-items-center rounded-full bg-accent/15 text-accent animate-in zoom-in-50 duration-500">
                <CheckCircle2 className="h-12 w-12" strokeWidth={2.2} aria-hidden />
              </div>
            </div>
            <div className="space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <p className="text-2xl font-semibold tracking-tight">{successTitle}</p>
              {successSubtitle && (
                <p className="text-sm text-muted-foreground">{successSubtitle}</p>
              )}
            </div>
            {successActions && (
              <div
                className="mt-2 w-full max-w-xs animate-in fade-in slide-in-from-bottom-3"
                // Delay para que aparezca DESPUÉS del check + título, no
                // pegado a la animación de zoom-in del verde.
                style={{ animationDelay: '600ms', animationDuration: '500ms', animationFillMode: 'both' }}
              >
                {successActions}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
