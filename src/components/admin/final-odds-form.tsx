'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setFinalChampionOdds } from '@/features/admin/actions'

type Finalist = { teamId: string; teamName: string; pct: number }

// Cuotas de campeón entre los finalistas. Alimentan el % de campeón/subcampeón
// que se muestra en las cards de predicciones.
export function FinalOddsForm({ finalOdds }: { finalOdds: Finalist[] }) {
  const [vals, setVals] = useState<Finalist[]>(() => finalOdds.map((o) => ({ ...o })))
  const [pending, startTransition] = useTransition()

  if (finalOdds.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aún no hay finalistas definidos (se llenan cuando el torneo llega a la final).
      </p>
    )
  }

  const total = vals.reduce((a, v) => a + (Number.isFinite(v.pct) ? v.pct : 0), 0)

  return (
    <div className="space-y-2">
      {vals.map((o, i) => (
        <div key={o.teamId} className="flex items-center gap-2">
          <span className="w-40 truncate text-sm font-medium">{o.teamName}</span>
          <Input
            type="number"
            min={0}
            max={100}
            value={o.pct}
            onChange={(e) =>
              setVals((v) => v.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) } : x)))
            }
            className="w-20"
          />
          <span className="text-xs text-muted-foreground">% de ser campeón</span>
        </div>
      ))}
      <p className={`text-[11px] ${total === 100 ? 'text-muted-foreground' : 'text-warning'}`}>
        Suma: {total}% {total !== 100 && '(se normaliza a 100% igual)'}
      </p>
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await setFinalChampionOdds({
              odds: vals.map((v) => ({ teamId: v.teamId, pct: v.pct })),
            })
            if (r.ok) toast.success('Cuotas guardadas')
            else toast.error(r.error)
          })
        }
      >
        {pending ? 'Guardando…' : 'Guardar cuotas'}
      </Button>
    </div>
  )
}
