'use client'

import { Maximize2, QrCode, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PoolDisclaimer } from '@/components/legal/pool-disclaimer'
import { QrImage } from '@/components/pool/qr-image'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  const [fullscreen, setFullscreen] = useState(false)
  useDialogBackButton(open, setOpen)
  useDialogBackButton(fullscreen, setFullscreen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" type="button">
          <QrCode className="h-3.5 w-3.5" />
          Ver QR
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aporta al pozo</DialogTitle>
          <DialogDescription className="sr-only">
            Escanea el QR del administrador con la app de tu banco para enviar tu aporte al pozo
            del grupo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-4">
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
          </div>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Escanea con la aplicación de tu banco. Avísale al administrador del grupo para que
              registre tu depósito.
            </p>
            <QrImage src={qrUrl} alt="QR de depósito" />
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setFullscreen(true)}
              className="w-full"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Pantalla completa
            </Button>
          </div>
        </div>
      </DialogContent>

      {fullscreen && <FullscreenQrOverlay src={qrUrl} onClose={() => setFullscreen(false)} />}
    </Dialog>
  )
}

function FullscreenQrOverlay({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="QR ampliado"
      className="fixed inset-0 z-[100] grid place-items-center bg-black p-4 sm:p-8"
      onClick={onClose}
    >
      {/* biome-ignore lint/performance/noImgElement: external QR (Supabase storage URL) */}
      <img
        src={src}
        alt="QR de depósito ampliado"
        className="max-h-[85vh] max-w-[85vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
