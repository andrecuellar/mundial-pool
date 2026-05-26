import { Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatMoney } from '@/lib/format'

type Props = {
  total: number
  currency: string | null
}

export function PoolChip({ total, currency }: Props) {
  if (total <= 0 || !currency) return null
  return (
    <Badge
      variant="secondary"
      className="gap-1 border-gold/30 bg-gold/10 text-gold font-medium tracking-tight"
    >
      <Wallet className="h-3 w-3" />
      {formatMoney(total, currency)}
    </Badge>
  )
}
