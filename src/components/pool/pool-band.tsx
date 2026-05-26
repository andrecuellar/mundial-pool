import { Wallet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { PoolSummary } from '@/features/pool/queries'
import { formatMoney, payoutRuleLabel } from '@/lib/format'

type Props = { pool: PoolSummary }

export function PoolBand({ pool }: Props) {
  if (!pool.enabled) return null
  return (
    <Card className="mt-5 flex flex-wrap items-center justify-between gap-3 border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-gold" />
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Pozo actual
        </span>
        <span className="font-semibold tabular-nums">
          {formatMoney(pool.total, pool.currency ?? 'BOB')}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">
        Payout: {payoutRuleLabel(pool.payoutRule)}
      </span>
    </Card>
  )
}
