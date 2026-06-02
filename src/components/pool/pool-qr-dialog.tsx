'use client'

import { QrCode } from 'lucide-react'
import { useState } from 'react'
import { PoolDisclaimer } from '@/components/legal/pool-disclaimer'
import { QrImage } from '@/components/pool/qr-image'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useDialogBackButton } from '@/hooks/use-dialog-back-button'
import { formatMoney } from '@/lib/format'

type Props = {
  qrUrl: string
  currency: string
  buyInAmount: number
  creatorDisplayName: string | null
  creatorEmail: string | null
}

export function PoolQrDialog({
  qrUrl,
  currency,
  buyInAmount,
  creatorDisplayName,
  creatorEmail,
}: Props) {
  const [open, setOpen] = useState(false)
  useDialogBackButton(open, setOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" type="button">
          <QrCode className="h-3.5 w-3.5" />
          Ver QR
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aporta al pozo</DialogTitle>
        </DialogHeader>

        <PoolDisclaimer variant="qr" />

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Le estás mandando dinero a
          </p>
          <p className="mt-1.5 text-base font-semibold">
            {creatorDisplayName ?? 'Administrador del grupo'}
          </p>
          {creatorEmail && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground break-all">
              {creatorEmail}
            </p>
          )}
          <div className="mt-3 border-t border-border pt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Monto a aportar
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
              {formatMoney(buyInAmount, currency)}
            </p>
          </div>
        </div>

        <QrImage src={qrUrl} alt="QR de depósito" />
        <p className="text-xs text-muted-foreground">
          Escanea con la aplicación de tu banco. Avísale al administrador del grupo para que
          registre tu depósito.
        </p>
      </DialogContent>
    </Dialog>
  )
}
