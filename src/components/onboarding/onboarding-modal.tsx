'use client'

import { CheckCircle2, ChevronLeft, ChevronRight, Lock, Trophy } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { markOnboarded } from '@/features/auth/onboarding'
import { useDialogBackButton } from '@/hooks/use-dialog-back-button'

type Step = {
  icon: typeof Trophy
  title: string
  body: string
  tone: 'primary' | 'warning' | 'accent'
}

const STEPS: Step[] = [
  {
    icon: Trophy,
    title: 'Eliges 14 predicciones del Mundial',
    body: 'Campeón, subcampeón, goleador, mejor jugador joven y mucho más. Una sola vez antes del partido inaugural del 11 de junio.',
    tone: 'primary',
  },
  {
    icon: Lock,
    title: 'Puedes editar hasta el cierre',
    body: 'Las predicciones quedan abiertas hasta el partido inaugural. Después del cierre son solo lectura y todos ven qué eligió cada uno.',
    tone: 'warning',
  },
  {
    icon: CheckCircle2,
    title: 'La app resuelve sola',
    body: 'Cuando termine cada fase del torneo, la app cruza los resultados oficiales con tus predicciones y reparte puntos automático. Solo entras a ver cómo vas.',
    tone: 'accent',
  },
]

type Props = {
  /** True if user has not been onboarded yet. */
  shouldShow: boolean
}

export function OnboardingModal({ shouldShow }: Props) {
  const [open, setOpen] = useState(shouldShow)
  const [step, setStep] = useState(0)
  const [pending, startTransition] = useTransition()
  useDialogBackButton(open, setOpen)

  if (!shouldShow) return null

  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  function finish() {
    startTransition(async () => {
      await markOnboarded()
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div
            className={`mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full ${
              current.tone === 'primary'
                ? 'bg-primary/10 text-primary'
                : current.tone === 'warning'
                  ? 'bg-warning/10 text-warning'
                  : 'bg-accent/10 text-accent'
            }`}
          >
            <Icon className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center">{current.title}</DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            {current.body}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-1.5 py-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="flex-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Atrás
          </Button>
          {isLast ? (
            <Button type="button" disabled={pending} onClick={finish} className="flex-1">
              {pending ? 'Cerrando…' : 'Entendido'}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="flex-1"
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
