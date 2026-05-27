'use client'

import { ExternalLink, Info, X } from 'lucide-react'
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

export type PlayerCategoryKey =
  | 'top_scorer_player'
  | 'top_assists_player'
  | 'golden_ball'
  | 'golden_glove'
  | 'young_player'

type Copy = {
  title: string
  description: string
  criterion: string
  tiebreaker?: string
  decidedBy: string
}

const COPY: Record<PlayerCategoryKey, Copy> = {
  top_scorer_player: {
    title: 'Bota de Oro',
    description: 'El jugador con más goles a lo largo de todo el Mundial.',
    criterion: 'Total de goles convertidos en los 104 partidos del torneo.',
    tiebreaker:
      'Si hay empate en goles: más asistencias → menos minutos jugados → fair play. Es el mismo desempate que usa FIFA para entregar la Bota de Oro.',
    decidedBy: 'Estadísticas oficiales que publica FIFA al cierre del torneo.',
  },
  top_assists_player: {
    title: 'Máximo Asistente',
    description: 'El jugador con más asistencias durante el torneo.',
    criterion:
      'Total de pases que terminaron en gol (asistencias oficiales según el registro de FIFA).',
    tiebreaker:
      'Si hay empate: menos minutos jugados → fair play. FIFA usa este criterio para destacar al jugador más eficaz por minuto en cancha.',
    decidedBy: 'Estadísticas oficiales que publica FIFA al cierre del torneo.',
  },
  golden_ball: {
    title: 'Balón de Oro',
    description: 'El mejor jugador del torneo, según el panel de FIFA.',
    criterion:
      'Lo elige el Technical Study Group de FIFA (un panel de exjugadores y técnicos) junto con una votación de medios acreditados al final del torneo. No es una estadística — es una decisión de jurado.',
    decidedBy: 'Decisión oficial de FIFA. Se anuncia el día de la final.',
  },
  golden_glove: {
    title: 'Guante de Oro',
    description: 'El mejor arquero del torneo, premio de FIFA al mejor portero.',
    criterion:
      'Lo elige el Technical Study Group de FIFA, considerando vallas invictas, atajadas decisivas y rendimiento general en el torneo.',
    decidedBy: 'Decisión oficial de FIFA. Se anuncia el día de la final.',
  },
  young_player: {
    title: 'Mejor jugador joven',
    description: 'Premio de FIFA al mejor jugador sub-21 del torneo.',
    criterion:
      'Lo elige el Technical Study Group + votación pública en FIFA.com. Solo elegibles jugadores nacidos en o después del 1° de enero de 2005 (sub-21 al inicio del Mundial 2026).',
    decidedBy: 'Decisión oficial de FIFA. Se anuncia el día de la final.',
  },
}

// Public stats page for the 2026 World Cup. FIFA updates this URL post-launch
// — if it 404s, we just remove the link in copy without breaking the modal.
const FIFA_STATS_URL =
  'https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup/canadamexicousa2026/statistics'

type Props = {
  kind: PlayerCategoryKey
  size?: 'sm' | 'md'
  className?: string
}

export function PlayerCategoryCriteriaDialog({ kind, size = 'sm', className }: Props) {
  const [open, setOpen] = useState(false)
  const iconSize = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  const c = COPY[kind]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label={`Cómo se decide ${c.title}`}
                className={`inline-grid place-items-center rounded-full border border-border bg-muted/40 p-1 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary ${className ?? ''}`}
              >
                <Info className={iconSize} />
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Haz click para ver cómo se decide</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cómo se decide · {c.title}</DialogTitle>
          <DialogDescription>{c.description}</DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Criterio
            </p>
            <p className="mt-1.5 text-sm leading-relaxed">{c.criterion}</p>
          </div>

          {c.tiebreaker && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Desempate
              </p>
              <p className="mt-1.5 text-sm leading-relaxed">{c.tiebreaker}</p>
            </div>
          )}

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
              Fuente
            </p>
            <p className="mt-1.5 text-sm leading-relaxed">{c.decidedBy}</p>
            <a
              href={FIFA_STATS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ver estadísticas oficiales del Mundial 2026
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Resolución manual al cierre del Mundial</span>:
            el admin de mundial-pool toma el dato de FIFA y lo registra en la app. Los puntos se
            reparten automáticamente a quienes acertaron.
          </div>
        </section>

        <Button onClick={() => setOpen(false)} variant="outline" className="w-full">
          <X className="h-3.5 w-3.5" />
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  )
}
