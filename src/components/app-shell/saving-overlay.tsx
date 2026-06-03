'use client'

import { CheckCircle2, type LucideIcon } from 'lucide-react'

type Props = {
  phase: 'idle' | 'saving' | 'success'
  icon: LucideIcon
  savingTitle: string
  savingSubtitle?: string
  successTitle?: string
  successSubtitle?: string
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
}: Props) {
  if (phase === 'idle') return null

  return (
    <div
      role="status"
      aria-live="polite"
      // No fade-in: the overlay needs to feel instant so the user knows the
      // click registered. The pulse / check animations underneath provide the
      // sense of motion.
      className="fixed inset-0 z-[70] grid place-items-center bg-background/95 backdrop-blur-md"
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
          </>
        )}
      </div>
    </div>
  )
}
