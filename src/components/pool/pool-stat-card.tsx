import { QrCode, Wallet } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { PayoutEntry, PoolSummary } from '@/features/pool/queries'
import { formatMoney, payoutRuleLabel } from '@/lib/format'

type Props = {
  pool: PoolSummary
  payoutPreview: PayoutEntry[]
  groupSlug: string
  isOwner: boolean
}

export function PoolStatCard({ pool, payoutPreview, groupSlug, isOwner }: Props) {
  if (!pool.enabled) {
    return (
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Pozo del grupo
            </p>
            <p className="mt-1 text-sm text-muted-foreground">No activado.</p>
          </div>
          {isOwner && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/groups/${groupSlug}/admin/pool`}>Activar</Link>
            </Button>
          )}
        </div>
      </Card>
    )
  }

  const currency = pool.currency ?? 'BOB'

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border bg-gradient-to-br from-gold/5 to-transparent p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <Wallet className="h-3 w-3" />
              Pozo del grupo
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {formatMoney(pool.total, currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pool.transactionCount} {pool.transactionCount === 1 ? 'depósito' : 'depósitos'} ·{' '}
              {payoutRuleLabel(pool.payoutRule)}
            </p>
          </div>
          {pool.qrUrl && (
            <Dialog>
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
                <img
                  src={pool.qrUrl}
                  alt="QR de depósito"
                  className="w-full rounded-lg border border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Escanea con tu app bancaria. Avísale al owner del grupo para que registre tu
                  depósito.
                </p>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {payoutPreview.length > 0 && (
        <div className="space-y-1.5 p-5 text-sm">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Si terminara hoy
          </p>
          <ul className="space-y-1">
            {payoutPreview.map((p) => (
              <li key={p.userId} className="flex items-center justify-between gap-3 tabular-nums">
                <span className="flex items-center gap-2">
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${
                      p.rank === 1
                        ? 'bg-gold/15 text-gold'
                        : p.rank === 2
                          ? 'bg-silver/15 text-silver'
                          : 'bg-bronze/15 text-bronze'
                    }`}
                  >
                    {p.rank}
                  </span>
                  <span className="truncate">{p.displayName}</span>
                </span>
                <span className="font-medium">{formatMoney(p.amount, currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOwner && (
        <div className="border-t border-border p-3">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href={`/groups/${groupSlug}/admin/pool`}>Administrar pozo</Link>
          </Button>
        </div>
      )}
    </Card>
  )
}
