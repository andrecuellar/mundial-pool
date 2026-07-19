import { TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'

type TopEntry = { label: string; prob: number }

function fmtPct(prob: number): string {
  const pct = Math.round(prob * 100)
  return prob > 0 && pct < 1 ? '<1%' : `${pct}%`
}

// Probabilidad de que gane cada candidato, por categoría. Calculada del estado
// del torneo + las cuotas de la final (editables en /admin/sistema).
export function CategoryOddsCard({
  categories,
  topByCategory,
}: {
  categories: { key: string; name: string }[]
  topByCategory: Record<string, TopEntry[]>
}) {
  const rows = categories
    .map((c) => ({ name: c.name, tops: topByCategory[c.key] ?? [] }))
    .filter((r) => r.tops.length > 0)
  if (rows.length === 0) return null
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          Probabilidades por categoría
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Chance de que gane cada candidato, según el estado del torneo y las cuotas de la final.
        </p>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0 truncate text-sm text-muted-foreground">{r.name}</span>
            <span className="flex flex-wrap items-center justify-end gap-1.5">
              {r.tops.map((t, i) => (
                <span
                  key={t.label}
                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs ${
                    i === 0
                      ? 'border-success/30 font-semibold text-success'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  <span className="max-w-[9rem] truncate">{t.label}</span>
                  <span className="tabular-nums">{fmtPct(t.prob)}</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
