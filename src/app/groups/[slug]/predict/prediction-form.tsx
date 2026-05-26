'use client'

import { Check } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { TeamComboBox } from '@/components/predict/team-combobox'
import { TeamSetGrid } from '@/components/predict/team-set-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { submitPredictions } from '@/features/predictions/actions'
import type { PredictionFormCategory } from '@/features/predictions/queries'

type Team = { id: string; name: string; flagEmoji: string | null; fifaCode: string | null }

type Props = {
  groupSlug: string
  categories: PredictionFormCategory[]
  teams: Team[]
  locked: boolean
}

type DraftValue = {
  teamId?: string | null
  teamSet?: string[]
  playerText?: string
}

function isFilled(c: PredictionFormCategory, v: DraftValue): boolean {
  if (c.valueKind === 'team') return !!v.teamId
  if (c.valueKind === 'team_set') {
    const n = (c.metadata as { n?: number } | null)?.n ?? 2
    return (v.teamSet?.length ?? 0) === n
  }
  if (c.valueKind === 'player') return !!v.playerText && v.playerText.trim().length > 0
  return false
}

export function PredictionForm({ groupSlug, categories, teams, locked }: Props) {
  const [draft, setDraft] = useState<Record<string, DraftValue>>(() => {
    const init: Record<string, DraftValue> = {}
    for (const c of categories) {
      init[c.id] = {
        teamId: c.current?.teamId ?? undefined,
        teamSet: c.current?.teamSet ?? undefined,
        playerText: c.current?.playerText ?? undefined,
      }
    }
    return init
  })
  const [pending, startTransition] = useTransition()

  const completed = useMemo(
    () => categories.filter((c) => isFilled(c, draft[c.id] ?? {})).length,
    [categories, draft],
  )
  const total = categories.length

  function update(id: string, patch: DraftValue) {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    for (const c of categories) {
      const v = draft[c.id] ?? {}
      if (c.valueKind === 'team' && v.teamId) {
        fd.append(`cat:${c.key}`, v.teamId)
      } else if (c.valueKind === 'team_set' && v.teamSet) {
        for (const t of v.teamSet) fd.append(`cat:${c.key}`, t)
      } else if (c.valueKind === 'player' && v.playerText) {
        fd.append(`cat:${c.key}`, v.playerText)
      }
    }
    startTransition(async () => {
      const r = await submitPredictions(groupSlug, fd)
      if (r.ok) toast.success('Predicciones guardadas')
      else toast.error(r.error)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="sticky top-14 sm:top-16 z-20 -mx-4 sm:-mx-6 mb-5 border-b border-border bg-background/90 px-4 sm:px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Mis predicciones</p>
            <div className="flex items-center gap-2 font-mono text-sm font-semibold tabular-nums">
              <span className={completed === total ? 'text-success' : 'text-foreground'}>
                {completed}
              </span>
              <span className="text-muted-foreground">/ {total}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block h-1 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all ${
                  completed === total ? 'bg-accent' : 'bg-primary'
                }`}
                style={{ width: `${(completed / total) * 100}%` }}
              />
            </div>
            <Button type="submit" disabled={locked || pending} size="lg">
              {locked ? 'Bloqueado' : pending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {categories.map((c, idx) => {
          const v = draft[c.id] ?? {}
          const filled = isFilled(c, v)
          const kindLabel =
            c.valueKind === 'player'
              ? 'JUGADOR'
              : c.valueKind === 'team_set'
                ? `${(c.metadata as { n?: number } | null)?.n ?? 2} EQUIPOS`
                : 'EQUIPO'
          const n = (c.metadata as { n?: number } | null)?.n ?? 2
          const perItem = (c.metadata as { scoring?: string } | null)?.scoring === 'per_match'

          return (
            <Card
              key={c.id}
              className={`p-5 transition-colors ${filled ? 'border-accent/40' : 'border-border'} ${locked ? 'opacity-70' : ''}`}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground tracking-wider">
                  {String(idx + 1).padStart(2, '0')} · {kindLabel}
                </span>
                <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary tracking-wider">
                  {c.points} PTS{perItem ? '/ACIERTO' : ''}
                </span>
                {filled && (
                  <Badge className="gap-1 border-accent/30 bg-accent/15 text-accent">
                    <Check className="h-3 w-3" /> Listo
                  </Badge>
                )}
              </div>
              <h3 className="text-base font-semibold tracking-tight">{c.name}</h3>
              {c.description && (
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {c.description}
                </p>
              )}

              <div className="mt-4">
                {c.valueKind === 'team' && (
                  <TeamComboBox
                    teams={teams}
                    value={v.teamId ?? null}
                    onChange={(id) => update(c.id, { teamId: id })}
                    disabled={locked}
                  />
                )}
                {c.valueKind === 'team_set' && n === 2 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[0, 1].map((i) => (
                      <div key={i}>
                        <Label className="text-xs text-muted-foreground">
                          Finalista {String.fromCharCode(65 + i)}
                        </Label>
                        <div className="mt-1">
                          <TeamComboBox
                            teams={teams}
                            value={v.teamSet?.[i] ?? null}
                            onChange={(id) => {
                              const next = [...(v.teamSet ?? [])]
                              if (id) next[i] = id
                              else next.splice(i, 1)
                              update(c.id, { teamSet: next.filter(Boolean) })
                            }}
                            disabled={locked}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {c.valueKind === 'team_set' && n > 2 && (
                  <TeamSetGrid
                    teams={teams}
                    selected={v.teamSet ?? []}
                    onChange={(next) => update(c.id, { teamSet: next })}
                    n={n}
                    disabled={locked}
                  />
                )}
                {c.valueKind === 'player' && (
                  <div className="space-y-2">
                    <Input
                      value={v.playerText ?? ''}
                      onChange={(e) => update(c.id, { playerText: e.target.value })}
                      placeholder="Nombre completo del jugador (ej: Lionel Messi)"
                      disabled={locked}
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">
                      Verificaremos contra el premio oficial FIFA al cierre del torneo.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {!locked && (
        <Card className="mt-5 flex items-center justify-between gap-4 border-primary/20 bg-primary/5 p-5">
          <div>
            <p className="text-sm font-medium">Guardar mis predicciones</p>
            <p className="text-xs text-muted-foreground">
              {completed === total
                ? '¡Listo! Tienes las 13 categorías completas.'
                : `Te quedan ${total - completed} ${total - completed === 1 ? 'categoría' : 'categorías'} por llenar. Puedes guardar parciales y volver después.`}
            </p>
          </div>
          <Button type="submit" disabled={pending} size="lg">
            {pending ? 'Guardando…' : 'Guardar'}
            <Check className="h-4 w-4" />
          </Button>
        </Card>
      )}
    </form>
  )
}
