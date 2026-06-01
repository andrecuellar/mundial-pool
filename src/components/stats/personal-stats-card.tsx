import { Target, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { UserCategoryBreakdownRow } from '@/features/scoring/queries'

type Props = {
  rows: UserCategoryBreakdownRow[]
  totalPoints: number
  rank: number | null
  rankLabel: string | null
  totalPlayers: number
}

export function PersonalStatsCard({ rows, totalPoints, rank, rankLabel, totalPlayers }: Props) {
  const resolved = rows.filter((r) => r.status !== 'pending')
  const correct = rows.filter((r) => r.status === 'correct')
  const accuracy =
    resolved.length === 0 ? null : Math.round((correct.length / resolved.length) * 100)

  // Best category by earned points.
  const bestCategory =
    rows.length === 0 ? null : [...rows].sort((a, b) => b.earnedPoints - a.earnedPoints)[0]
  const showBest = bestCategory && bestCategory.earnedPoints > 0

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <TrendingUp className="h-3 w-3 text-primary" />
          Mis stats
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {resolved.length} / {rows.length} resueltas
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Puntos
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalPoints}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Posición
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {rank && rankLabel ? rankLabel : '—'}
            {rank && totalPlayers > 0 && (
              <span className="ml-1 text-sm text-muted-foreground">/ {totalPlayers}</span>
            )}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Accuracy
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {accuracy === null ? '—' : `${accuracy}%`}
          </p>
          {resolved.length > 0 && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">{correct.length} aciertos</p>
          )}
        </div>
      </div>

      {showBest && bestCategory && (
        <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <Target className="h-3 w-3 text-accent" />
            Mejor categoría
          </p>
          <p className="mt-1 text-sm font-medium">
            {bestCategory.name}{' '}
            <span className="font-mono text-xs text-accent">+{bestCategory.earnedPoints} pts</span>
          </p>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Por categoría
        </p>
        <div className="flex flex-wrap gap-1">
          {rows.map((r) => (
            <div
              key={r.key}
              title={`${r.name}${r.pickLabel ? ` · pick: ${r.pickLabel}` : ''}${
                r.resultLabel ? ` · resultado: ${r.resultLabel}` : ''
              }`}
              className={`h-2.5 w-2.5 rounded-full ${
                r.status === 'correct'
                  ? 'bg-accent'
                  : r.status === 'incorrect'
                    ? 'bg-destructive/60'
                    : r.status === 'no_pick'
                      ? 'bg-muted'
                      : 'bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            acierto
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive/60" />
            error
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
            pendiente
          </span>
        </div>
      </div>
    </Card>
  )
}
