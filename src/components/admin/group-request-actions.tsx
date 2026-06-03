'use client'

import { Check, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  approveGroupCreationRequest,
  rejectGroupCreationRequest,
} from '@/features/groups/requests'

type Props = {
  requestId: string
  displayName: string
}

// Inline approve/reject controls for the admin /solicitudes table. Approve is
// a single-step confirm (1-line dialog); reject opens a dialog with an
// optional reason textarea.
export function GroupRequestActions({ requestId, displayName }: Props) {
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      const r = await approveGroupCreationRequest({ requestId })
      if (r.ok) {
        toast.success(`Aprobaste a ${displayName}`)
        setApproveOpen(false)
      } else toast.error(r.error)
    })
  }

  function handleReject() {
    startTransition(async () => {
      const r = await rejectGroupCreationRequest({
        requestId,
        reason: reason.trim() === '' ? null : reason.trim(),
      })
      if (r.ok) {
        toast.success(`Rechazaste a ${displayName}`)
        setRejectOpen(false)
        setReason('')
      } else toast.error(r.error)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <Button size="sm" onClick={() => setApproveOpen(true)}>
          <Check className="h-3.5 w-3.5" />
          Aprobar
        </Button>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Aprobar a {displayName}?</DialogTitle>
            <DialogDescription>
              Le das permiso permanente para crear grupos. Podrá crear todos los que quiera sin
              volver a pedir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} disabled={pending}>
              {pending ? 'Aprobando…' : 'Aprobar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <Button variant="ghost" size="sm" onClick={() => setRejectOpen(true)}>
          <X className="h-3.5 w-3.5" />
          Rechazar
        </Button>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Rechazar a {displayName}?</DialogTitle>
            <DialogDescription>
              El usuario podrá pedir permiso de nuevo más adelante. La razón es opcional pero le
              ayuda a entender qué pasó.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: cuenta sospechosa, info insuficiente, etc."
              maxLength={500}
              rows={3}
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              Si lo dejás vacío, el usuario solo recibe el aviso genérico de rechazo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={pending}>
              {pending ? 'Rechazando…' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
