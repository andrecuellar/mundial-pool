'use client'

import { ArrowRight, Info, Trophy, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Props = {
  /** Visual size of the trigger icon. */
  size?: 'sm' | 'md'
  /** Extra classes for the trigger button. */
  className?: string
}

export function RevelationCriteriaDialog({ size = 'sm', className }: Props) {
  const [open, setOpen] = useState(false)
  const iconSize = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="Cómo se decide Revelación / Decepción"
                className={`inline-grid place-items-center rounded-full border border-border bg-muted/40 p-1 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary ${className ?? ''}`}
              >
                <Info className={iconSize} />
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Tocá para ver cómo se decide</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
        <CriteriaBody onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

type LinkProps = {
  kind: 'revelation' | 'disappointment'
  className?: string
}

export function RevelationCriteriaLink({ kind, className }: LinkProps) {
  const [open, setOpen] = useState(false)
  const label =
    kind === 'revelation'
      ? 'Haz click aquí para ver cómo decidiremos la selección revelación.'
      : 'Haz click aquí para ver cómo decidiremos la selección decepción.'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`inline text-left font-medium text-primary underline-offset-4 hover:underline ${className ?? ''}`}
        >
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
        <CriteriaBody onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CriteriaBody({ onClose }: { onClose: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Cómo se decide Revelación y Decepción</DialogTitle>
        <DialogDescription>
          Comparamos cuán arriba o abajo terminó cada selección respecto a lo que predecía su
          ranking FIFA pre-Mundial.
        </DialogDescription>
      </DialogHeader>

      <FormulaDiagram />
      <RankingTable />
      <TiebreakersList />

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
        📅 El ranking FIFA usado es el del{' '}
        <span className="font-medium text-foreground">9 de junio de 2026</span> (última
        actualización oficial antes del Mundial).
      </div>

      <Button onClick={onClose} variant="outline" className="w-full">
        <X className="h-3.5 w-3.5" />
        Cerrar
      </Button>
    </>
  )
}

function FormulaDiagram() {
  return (
    <section className="space-y-3">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Fórmula
      </h3>
      <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
        <ExampleRow
          headline="Ejemplo · Revelación"
          headlineTone="accent"
          fifaRank="#28"
          fifaSub="Costa Rica 2014"
          tournamentRank="#5"
          tournamentSub="Llegó a cuartos"
          delta="+23"
          deltaSub="Salto hacia arriba"
          deltaTone="accent"
        />
        <div className="h-px bg-border" />
        <ExampleRow
          headline="Ejemplo · Decepción"
          headlineTone="destructive"
          fifaRank="#1"
          fifaSub="España 2014"
          tournamentRank="#25"
          tournamentSub="Eliminada en grupos"
          delta="−24"
          deltaSub="Caída fuerte"
          deltaTone="destructive"
        />
        <ul className="mt-2 space-y-1.5 text-xs">
          <li className="flex items-center gap-2 text-foreground">
            <span className="inline-grid h-4 w-4 place-items-center rounded-full bg-accent/15 text-accent">
              ★
            </span>
            <span>
              <span className="font-semibold text-accent">Mayor delta positivo</span> = Revelación
              (subió más posiciones que cualquier otro)
            </span>
          </li>
          <li className="flex items-center gap-2 text-foreground">
            <span className="inline-grid h-4 w-4 place-items-center rounded-full bg-destructive/15 text-destructive">
              ✗
            </span>
            <span>
              <span className="font-semibold text-destructive">Mayor delta negativo</span> =
              Decepción (cayó más posiciones que cualquier otro)
            </span>
          </li>
        </ul>
      </div>
    </section>
  )
}

function ExampleRow({
  headline,
  headlineTone,
  fifaRank,
  fifaSub,
  tournamentRank,
  tournamentSub,
  delta,
  deltaSub,
  deltaTone,
}: {
  headline: string
  headlineTone: 'accent' | 'destructive'
  fifaRank: string
  fifaSub: string
  tournamentRank: string
  tournamentSub: string
  delta: string
  deltaSub: string
  deltaTone: 'accent' | 'destructive'
}) {
  return (
    <div className="space-y-2">
      <p
        className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
          headlineTone === 'accent' ? 'text-accent' : 'text-destructive'
        }`}
      >
        {headline}
      </p>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ScalePill label="Rank FIFA pre-Mundial" value={fifaRank} sub={fifaSub} tone="muted" />
        <ArrowRight className="hidden h-5 w-5 shrink-0 self-center text-muted-foreground sm:block" />
        <ScalePill
          label="Rank Torneo final"
          value={tournamentRank}
          sub={tournamentSub}
          tone="muted"
        />
        <span className="hidden text-2xl font-bold text-muted-foreground sm:inline">=</span>
        <ScalePill label="Delta" value={delta} sub={deltaSub} tone={deltaTone} />
      </div>
    </div>
  )
}

function ScalePill({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone: 'muted' | 'accent' | 'destructive'
}) {
  const toneClass =
    tone === 'accent'
      ? 'border-accent/30 bg-accent/10 text-accent'
      : tone === 'destructive'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : 'border-border bg-card text-foreground'
  return (
    <div className={`flex-1 rounded-lg border p-3 ${toneClass}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  )
}

const BRACKETS: { rank: string; label: string; tiebreaker: string }[] = [
  { rank: '1', label: 'Campeón', tiebreaker: '—' },
  { rank: '2', label: 'Subcampeón', tiebreaker: '—' },
  { rank: '3', label: 'Tercer lugar', tiebreaker: '—' },
  { rank: '4', label: 'Cuarto lugar', tiebreaker: '—' },
  {
    rank: '5 – 8',
    label: 'Perdedores de cuartos',
    tiebreaker: 'Penales primero → goles → fair play, luego perdedores en regulación por DG',
  },
  {
    rank: '9 – 16',
    label: 'Perdedores de octavos',
    tiebreaker: 'Mismo criterio que cuartos',
  },
  {
    rank: '17 – 32',
    label: 'Perdedores de dieciseisavos',
    tiebreaker: 'Mismo criterio que cuartos',
  },
  {
    rank: '33 – 48',
    label: 'Eliminados en fase de grupos',
    tiebreaker: 'Puntos del grupo → DG → GF → fair play',
  },
]

function RankingTable() {
  return (
    <section className="space-y-3">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Cómo se arma el ranking del torneo (1 → 48)
      </h3>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Posición</th>
              <th className="px-3 py-2 text-left font-medium">Quiénes</th>
              <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">Desempate</th>
            </tr>
          </thead>
          <tbody>
            {BRACKETS.map((b, i) => (
              <tr key={b.rank} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/15'}>
                <td className="px-3 py-2 align-top">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums">
                    {b.rank === '1' && <Trophy className="h-3 w-3 text-gold" />}
                    {b.rank}
                  </span>
                </td>
                <td className="px-3 py-2 align-top text-xs font-medium text-foreground sm:text-sm">
                  {b.label}
                </td>
                <td className="hidden px-3 py-2 align-top text-xs text-muted-foreground leading-relaxed sm:table-cell">
                  {b.tiebreaker}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TiebreakersList() {
  return (
    <section className="space-y-3">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Detalle de desempates en eliminación directa
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
          <p className="text-sm font-semibold text-foreground">A. Perdió por penales</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            (empató en 90 min + alargue, perdió en la tanda de penales)
          </p>
          <ol className="mt-2 space-y-1 text-xs text-muted-foreground leading-relaxed">
            <li>
              <span className="font-semibold text-foreground">1.</span> Más goles en el partido
              (antes de penales)
            </li>
            <li>
              <span className="font-semibold text-foreground">2.</span> Fair play — menos amarillas
              + rojas en el torneo
            </li>
          </ol>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-sm font-semibold text-foreground">B. Perdió por derrota</p>
          <p className="mt-0.5 text-xs text-muted-foreground">(en regulación o alargue)</p>
          <ol className="mt-2 space-y-1 text-xs text-muted-foreground leading-relaxed">
            <li>
              <span className="font-semibold text-foreground">1.</span> Mejor diferencia de goles
              del partido
            </li>
            <li>
              <span className="font-semibold text-foreground">2.</span> Más goles a favor en el
              partido
            </li>
            <li>
              <span className="font-semibold text-foreground">3.</span> Fair play — menos amarillas
              + rojas en el torneo
            </li>
          </ol>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Los que perdieron por penales se ordenan{' '}
        <span className="text-foreground">antes</span> de los que perdieron por derrota dentro de
        cada bracket (4 perdedores de cuartos, 8 de octavos, 16 de dieciseisavos).
      </p>
    </section>
  )
}
