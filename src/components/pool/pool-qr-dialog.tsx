'use client'

import { QrCode } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useDialogBackButton } from '@/hooks/use-dialog-back-button'

type Props = {
  qrUrl: string
}

export function PoolQrDialog({ qrUrl }: Props) {
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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Aporta al pozo</DialogTitle>
        </DialogHeader>
        {/* biome-ignore lint/performance/noImgElement: external QR */}
        <img src={qrUrl} alt="QR de depósito" className="w-full rounded-lg border border-border" />
        <p className="text-xs text-muted-foreground">
          Escanea con tu app bancaria. Avísale al admin del grupo para que registre tu depósito.
        </p>
      </DialogContent>
    </Dialog>
  )
}
