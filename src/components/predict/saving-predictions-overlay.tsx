'use client'

import { CheckCircle2, Trophy } from 'lucide-react'

type Props = {
  phase: 'idle' | 'saving' | 'success'
}

// Full-screen overlay that covers the prediction form while the server
// action runs and during the transition into the comprobante page. Has two
// visible phases: a spinning trophy with concentric rings ('saving') and a
// scale-in checkmark ('success'). Idle = unmounted.
export function SavingPredictionsOverlay({ phase }: Props) {
  if (phase === 'idle') return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[70] grid place-items-center bg-background/95 backdrop-blur-md animate-in fade-in duration-200"
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
                <Trophy className="h-9 w-9 mp-trophy-spin" aria-hidden />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-lg font-semibold tracking-tight">
                Guardando tus predicciones
                <span className="mp-ellipsis" aria-hidden />
              </p>
              <p className="text-sm text-muted-foreground">
                Un momento mientras dejamos todo registrado
              </p>
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
              <p className="text-2xl font-semibold tracking-tight">¡Listo!</p>
              <p className="text-sm text-muted-foreground">Preparando tu comprobante</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
