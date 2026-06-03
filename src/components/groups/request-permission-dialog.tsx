'use client'

import { Send } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
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
}

export function RequestPermissionDialog({ trigger, variant = 'first' }: Props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await requestGroupCreation({
        message: message.trim() === '' ? null : message.trim(),
      })
      if (r.ok) {
        toast.success('Solicitud enviada. Te avisaremos por notificación cuando la revisen.')
        setMessage('')
        setOpen(false)
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {variant === 'retry'
              ? 'Pedir permiso de nuevo'
              : 'Pedir permiso para crear un grupo'}
          </DialogTitle>
          <DialogDescription>
            {variant === 'retry'
              ? 'Mandá una nueva solicitud al admin. Si quieres, cuéntale qué cambió desde la anterior.'
              : 'Para evitar spam, todos los nuevos grupos pasan por aprobación. Mandá una solicitud al admin y te avisamos cuando responda.'}
          </DialogDescription>
        </DialogHeader>
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
  )
}
