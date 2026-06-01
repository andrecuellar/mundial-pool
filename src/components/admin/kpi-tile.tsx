import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

type Props = {
  label: string
  value: string | number
  sub?: string
  icon?: LucideIcon
  tone?: 'default' | 'warning' | 'destructive' | 'accent'
}

export function KpiTile({ label, value, sub, icon: Icon, tone = 'default' }: Props) {
  const iconClass =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'destructive'
        ? 'text-destructive'
        : tone === 'accent'
          ? 'text-accent'
          : 'text-primary'
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} />}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </Card>
  )
}
