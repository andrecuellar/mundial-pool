'use client'

import { Ban, ShieldCheck } from 'lucide-react'
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
import { banUser, unbanUser } from '@/features/admin/actions'

type Props = {
  userId: string
  displayName: string
  isBanned: boolean
}

export function BanUserButton({ userId, displayName, isBanned }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  function handleBan() {
    startTransition(async () => {
      const r = await banUser({ userId, reason: reason.trim() === '' ? null : reason.trim() })
      if (r.ok) {
        toast.success(`${displayName} fue baneado`)
        setOpen(false)
        setReason('')
      } else toast.error(r.error)
    })
  }

  function handleUnban() {
    startTransition(async () => {
      const r = await unbanUser(userId)
      if (r.ok) {
        toast.success(`${displayName} fue desbaneado`)
        setOpen(false)
      } else toast.error(r.error)
    })
  }

  if (isBanned) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <ShieldCheck className="h-3.5 w-3.5" />
          Desbanear
        </Button>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Desbanear a {displayName}?</DialogTitle>
            <DialogDescription>
              El usuario podrá volver a entrar a mundial-pool inmediatamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={handleUnban} disabled={pending}>
              {pending ? 'Desbaneando…' : 'Desbanear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Ban className="h-3.5 w-3.5" />
        Banear
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Banear a {displayName}?</DialogTitle>
          <DialogDescription>
            Sus datos (grupos, predicciones, aportes) no se eliminan. Solo pierde el acceso a la
            app. Puedes desbanear después.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Motivo (opcional)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: usuario desconocido creó un pozo sin consentimiento"
            maxLength={500}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            El usuario verá este motivo en la pantalla de baneo.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleBan} disabled={pending}>
            {pending ? 'Baneando…' : 'Banear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
