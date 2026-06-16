'use client'

import { Send } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SavingOverlay } from '@/components/app-shell/saving-overlay'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { requestGroupCreation } from '@/features/groups/requests'
import { Button } from '../ui/button'

type Props = {
  /** The element that opens the dialog when clicked. Forwarded via Radix Slot. */
  trigger: React.ReactNode
  /** Headline of the dialog — tunes copy for first-time vs re-request flows. */
  variant?: 'first' | 'retry'
  /** On retries, the admin's previous rejection reason — shown so the user answers it. */
  previousReason?: string | null
}

export function RequestPermissionDialog({ trigger, variant = 'first', previousReason }: Props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const [phase, setPhase] = useState<'idle' | 'saving' | 'success'>('idle')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPhase('saving')
    startTransition(async () => {
      const r = await requestGroupCreation({
        message: message.trim() === '' ? null : message.trim(),
      })
      if (r.ok) {
        setPhase('success')
        setTimeout(() => {
          toast.success('Solicitud enviada. Te avisaremos por notificación cuando la revisen.')
          setMessage('')
          setOpen(false)
          setPhase('idle')
        }, 800)
      } else {
        setPhase('idle')
        toast.error(r.error)
      }
    })
  }

  return (
    <>
      <SavingOverlay
        phase={phase}
        icon={Send}
        savingTitle="Enviando solicitud"
        savingSubtitle="Notificando al admin"
        successTitle="Solicitud enviada"
        successSubtitle="Te avisamos cuando responda"
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {variant === 'retry' ? 'Pedir permiso de nuevo' : 'Pedir permiso para crear un grupo'}
            </DialogTitle>
            <DialogDescription>
              {variant === 'retry'
                ? 'Envía una nueva solicitud al admin. Si quieres, cuéntale qué cambió desde la anterior.'
                : 'Para evitar spam, todos los nuevos grupos pasan por aprobación. Envía una solicitud al admin y te avisamos cuando responda.'}
            </DialogDescription>
          </DialogHeader>
          {variant === 'retry' && previousReason && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-foreground">El admin te rechazó antes con este motivo:</p>
              <p className="mt-1 text-muted-foreground leading-relaxed">{previousReason}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Respóndelo aquí para mejorar tus chances.
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">Mensaje (opcional)</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Para qué quieres crear grupos, con quiénes vas a jugar, etc."
                maxLength={500}
                rows={4}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                Máximo 500 caracteres. Ayuda al admin a decidir más rápido.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                <Send className="h-3.5 w-3.5" />
                {pending ? 'Enviando…' : 'Enviar solicitud'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
