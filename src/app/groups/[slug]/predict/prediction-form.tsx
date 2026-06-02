'use client'

import { AlertTriangle, Check, Info, Lock, Trophy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  PlayerCategoryCriteriaDialog,
  type PlayerCategoryKey,
} from '@/components/predict/player-category-criteria-dialog'
import { PlayerComboBox } from '@/components/predict/player-combobox'
import {
  RevelationCriteriaDialog,
  RevelationCriteriaLink,
} from '@/components/predict/revelation-criteria-dialog'
import { SavingOverlay } from '@/components/app-shell/saving-overlay'
import { TeamComboBox } from '@/components/predict/team-combobox'
import { TeamSetGrid } from '@/components/predict/team-set-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { submitPredictions } from '@/features/predictions/actions'
import type { PlayerOption, PredictionFormCategory } from '@/features/predictions/queries'

type Team = {
  id: string
  name: string
  flagEmoji: string | null
  fifaCode: string | null
  fifaRanking?: number | null
}

// Last FIFA ranking update before the World Cup is scheduled for 9 June 2026
// (2 days before the opening match).
const FIFA_FINAL_UPDATE = new Date('2026-06-09T00:00:00Z')
const FIFA_RANKING_CATEGORIES = new Set(['revelation', 'disappointment'])
const PLAYER_MANUAL_CATEGORIES: ReadonlySet<PlayerCategoryKey> = new Set([
  'top_scorer_player',
  'top_assists_player',
  'golden_ball',
  'golden_glove',
  'young_player',
])

// Per-category "Sugerencias" surfaced at the top of the player combobox when
// the user opens it without typing. These are patterns matched against the
// player's normalized full name; the first hit per pattern wins, and the
// suggestions also get filtered out of the main list to avoid duplication.
// Picks are based on form going into the 2026 World Cup — recent goal-scoring,
// awards, and tournament expectations.
const PLAYER_SUGGESTIONS: Record<PlayerCategoryKey, string[]> = {
  top_scorer_player: [
    'kylian mbappé',
    'erling haaland',
    'harry kane',
    'lautaro martínez',
    'julián alvarez',
    'vinícius júnior',
    'lionel messi',
    'cristiano ronaldo',
    'lamine yamal',
    'romelu lukaku',
  ],
  top_assists_player: [
    'lamine yamal',
    'lionel messi',
    'bruno fernandes',
    'kevin de bruyne',
    'jude bellingham',
    'bernardo silva',
    'pedri',
    'bukayo saka',
  ],
  golden_ball: [
    'kylian mbappé',
    'jude bellingham',
    'rodri',
    'vinícius júnior',
    'erling haaland',
    'lionel messi',
    'lamine yamal',
    'pedri',
    'jamal musiala',
  ],
  golden_glove: [
    'emiliano martínez',
    'thibaut courtois',
    'alisson',
    'mike maignan',
    'unai simón',
    'jordan pickford',
    'ederson',
  ],
  young_player: [
    'lamine yamal',
    'endrick',
    'pau cubarsí',
    'désiré doué',
    'warren zaïre-emery',
    'arda güler',
    'jamal musiala',
  ],
}

function RankingHelper({ kind }: { kind: 'revelation' | 'disappointment' }) {
  const updatePassed = new Date() >= FIFA_FINAL_UPDATE
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed space-y-1.5">
      {kind === 'revelation' ? (
        <p>
          La selección con la mayor brecha positiva entre su{' '}
          <span className="font-medium text-foreground">ranking FIFA entre las 48 del Mundial</span>{' '}
          y la ronda alcanzada. Ejemplo:{' '}
          <span className="font-medium text-foreground">Costa Rica 2014</span> (FIFA #24 entre las
          32 → cuartos de final).
        </p>
      ) : (
        <p>
          La selección con la mayor brecha negativa entre su{' '}
          <span className="font-medium text-foreground">ranking FIFA entre las 48 del Mundial</span>{' '}
          y la ronda alcanzada. Ejemplo:{' '}
          <span className="font-medium text-foreground">España 2014</span> (FIFA #1 entre las 32 →
          eliminada en fase de grupos).
        </p>
      )}
      <p>
        {updatePassed
          ? '📅 Estos son los rankings finales pre-Mundial (última actualización: 9 de junio 2026).'
          : '📅 Habrá una última actualización del ranking FIFA el 9 de junio (2 días antes del partido inaugural).'}
      </p>
      <p>
        En el selector verás <span className="font-mono text-foreground">FIFA #N</span> (ranking
        global real) y <span className="font-mono text-primary">M #N</span> (posición entre las 48
        del Mundial, la que cuenta para esta categoría).
      </p>
      <p className="pt-1">
        <RevelationCriteriaLink kind={kind} />
      </p>
    </div>
  )
}

type Props = {
  groupSlug: string
  categories: PredictionFormCategory[]
  teams: Team[]
  players: PlayerOption[]
  locked: boolean
}

// FIFA Young Player Award eligibility: born on or after Jan 1, 2005
// (under 21 on the first day of the 2026 World Cup).
const YOUNG_PLAYER_MIN_DOB = '2005-01-01'

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

// Returns the team IDs to hide from the combobox of the given podium category
// so the user cannot pick the same team for champion / runner-up / third place.
// Only the OTHER podium spots are excluded — the team picked for the current
// category itself stays visible (handled by the combobox).
function podiumExcludesFor(
  key: string,
  draft: Record<string, DraftValue>,
  sourceIds: { champion?: string; runnerUp?: string; thirdPlace?: string },
): string[] {
  const ids: string[] = []
  const others: ('champion' | 'runnerUp' | 'thirdPlace')[] = (() => {
    if (key === 'champion') return ['runnerUp', 'thirdPlace']
    if (key === 'runner_up') return ['champion', 'thirdPlace']
    if (key === 'third_place') return ['champion', 'runnerUp']
    return []
  })()
  for (const other of others) {
    const otherCatId = sourceIds[other]
    if (!otherCatId) continue
    const teamId = draft[otherCatId]?.teamId
    if (teamId) ids.push(teamId)
  }
  return ids
}

type WarningContext = {
  draft: Record<string, DraftValue>
  sourceIds: { champion?: string; runnerUp?: string; thirdPlace?: string }
  revelationId?: string
  disappointmentId?: string
  top5Id?: string
  topFavoriteIds: Set<string>
  bottomFavoriteIds: Set<string>
}

// Returns the warning messages that apply to the current pick on a given
// category. Each card calls this with its own key + selected team — multiple
// warnings can stack (e.g. same team is both champion and runner-up, AND
// flagged as bottom-favorite as decepción).
function warningsFor(
  key: string,
  teamId: string | null | undefined,
  ctx: WarningContext,
): string[] {
  if (!teamId) return []
  const out: string[] = []
  const { draft, sourceIds, revelationId, disappointmentId, top5Id } = ctx
  const championPick = sourceIds.champion ? draft[sourceIds.champion]?.teamId : null
  const runnerUpPick = sourceIds.runnerUp ? draft[sourceIds.runnerUp]?.teamId : null
  const thirdPick = sourceIds.thirdPlace ? draft[sourceIds.thirdPlace]?.teamId : null
  const revPick = revelationId ? draft[revelationId]?.teamId : null
  const decPick = disappointmentId ? draft[disappointmentId]?.teamId : null
  const top5Pick = top5Id ? (draft[top5Id]?.teamSet ?? []) : []

  // Champion / Runner-up / Third-place mutual exclusion is enforced by the
  // combobox filter (see podiumExcludesFor), so no warnings needed for those.
  // The only cross-category check left is the conflict with Decepción.
  if (key === 'champion' && decPick === teamId) {
    out.push(
      'Esta selección también está marcada como decepción. Si fue campeona, no puede ser decepción al mismo tiempo.',
    )
  }
  if (key === 'runner_up' && decPick === teamId) {
    out.push(
      'Esta selección también está marcada como decepción. Llegar a la final no es decepción.',
    )
  }
  if (key === 'third_place' && decPick === teamId) {
    out.push('Esta selección también está marcada como decepción. Llegar al podio no es decepción.')
  }

  if (key === 'revelation') {
    if (ctx.topFavoriteIds.has(teamId)) {
      out.push(
        'No es revelación que esta selección termine entre las mejores — es una de las favoritas según el ranking FIFA. ¿No la estás confundiendo con Selección decepción?',
      )
    }
    if (decPick === teamId) {
      out.push(
        'La misma selección está marcada como revelación y como decepción — no puede ser las dos al mismo tiempo. Revisa cuál de las dos quieres cambiar.',
      )
    }
  }

  if (key === 'disappointment') {
    if (ctx.bottomFavoriteIds.has(teamId)) {
      out.push(
        'No es decepción que esta selección no destaque — es una de las menos favoritas según el ranking FIFA. ¿No la estás confundiendo con Selección revelación?',
      )
    }
    if (revPick === teamId) {
      out.push(
        'La misma selección está marcada como decepción y como revelación — no puede ser las dos al mismo tiempo. Revisa cuál de las dos quieres cambiar.',
      )
    }
    if (championPick === teamId) {
      out.push(
        'La misma selección está marcada como campeón. Si gana el Mundial, no puede ser decepción.',
      )
    }
    if (runnerUpPick === teamId) {
      out.push(
        'La misma selección está marcada como subcampeón. Llegar a la final no es decepción.',
      )
    }
    if (thirdPick === teamId) {
      out.push(
        'La misma selección está marcada como tercer lugar. Llegar al podio no es decepción.',
      )
    }
    if (top5Pick.includes(teamId)) {
      out.push(
        'La misma selección está dentro de tu Top 5. Si crees que va a estar en el top, no puede ser decepción.',
      )
    }
  }

  return out
}

function MismatchWarning({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p className="text-xs leading-relaxed">
          <span className="font-medium text-foreground">Alerta:</span>{' '}
          <span className="text-muted-foreground">{text}</span>
        </p>
      </div>
    </div>
  )
}

function getLockedFromSources(
  draft: Record<string, DraftValue>,
  ids: { champion?: string; runnerUp?: string; thirdPlace?: string },
) {
  const champion = ids.champion ? draft[ids.champion]?.teamId : null
  const runnerUp = ids.runnerUp ? draft[ids.runnerUp]?.teamId : null
  const thirdPlace = ids.thirdPlace ? draft[ids.thirdPlace]?.teamId : null
  return { champion, runnerUp, thirdPlace }
}

export function PredictionForm({ groupSlug, categories, teams, players, locked }: Props) {
  const byKey = useMemo(() => {
    const m: Record<string, PredictionFormCategory> = {}
    for (const c of categories) m[c.key] = c
    return m
  }, [categories])
  const sourceIds = {
    champion: byKey.champion?.id,
    runnerUp: byKey.runner_up?.id,
    thirdPlace: byKey.third_place?.id,
  }
  const finalistsId = byKey.finalists?.id
  const top5Id = byKey.top_5?.id
  const revelationId = byKey.revelation?.id
  const disappointmentId = byKey.disappointment?.id
  const sourceCategoryKeys = new Set(['champion', 'runner_up', 'third_place'])
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])

  // Pre-tournament FIFA-rank extremes + normalized 1→48 rank within the
  // tournament. The normalized rank is the one used to compute revelación /
  // decepción deltas (sorting teams by their global FIFA rank and assigning
  // 1 to the best of the 48 WC teams). It's also exposed in the team
  // combobox so the user can see BOTH numbers (real FIFA + Mundial-internal).
  const { topFavoriteIds, bottomFavoriteIds, internalRanks } = useMemo(() => {
    const ranked = teams.filter((t) => typeof t.fifaRanking === 'number')
    const ascending = [...ranked].sort(
      (a, b) => (a.fifaRanking as number) - (b.fifaRanking as number),
    )
    const internal = new Map<string, number>()
    ascending.forEach((t, i) => internal.set(t.id, i + 1))
    return {
      topFavoriteIds: new Set(ascending.slice(0, 5).map((t) => t.id)),
      bottomFavoriteIds: new Set(ascending.slice(-5).map((t) => t.id)),
      internalRanks: internal,
    }
  }, [teams])

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
  const [savePhase, setSavePhase] = useState<'idle' | 'saving' | 'success'>('idle')
  const router = useRouter()

  function recomputeDerived(next: Record<string, DraftValue>) {
    const { champion, runnerUp, thirdPlace } = getLockedFromSources(next, sourceIds)
    if (finalistsId) {
      const teamSet = [champion, runnerUp].filter((x): x is string => !!x)
      next[finalistsId] = { teamSet }
    }
    if (top5Id) {
      const locked = Array.from(
        new Set([champion, runnerUp, thirdPlace].filter((x): x is string => !!x)),
      )
      const current = next[top5Id]?.teamSet ?? []
      const userPicks = current.filter((id) => !locked.includes(id))
      next[top5Id] = { teamSet: [...locked, ...userPicks].slice(0, 5) }
    }
  }

  function update(id: string, patch: DraftValue) {
    setDraft((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } }
      // If a source for finalists/top_5 changed, recompute derived values.
      const cat = categories.find((c) => c.id === id)
      if (cat && sourceCategoryKeys.has(cat.key)) {
        recomputeDerived(next)
      } else if (id === top5Id) {
        // direct user pick on top_5: still enforce locked teams
        recomputeDerived(next)
      }
      return next
    })
  }

  const lockedFromSources = getLockedFromSources(draft, sourceIds)
  const lockedTop5 = Array.from(
    new Set(
      [lockedFromSources.champion, lockedFromSources.runnerUp, lockedFromSources.thirdPlace].filter(
        (x): x is string => !!x,
      ),
    ),
  )
  // Top-5 is gated behind a complete podium. Any stale picks the user might
  // already have saved (from before this gate existed) don't count as filled
  // until they fill the 3 source categories.
  const top5Gated = lockedTop5.length < 3
  const completed = useMemo(
    () =>
      categories.filter((c) => {
        if (c.key === 'top_5' && top5Gated) return false
        return isFilled(c, draft[c.id] ?? {})
      }).length,
    [categories, draft, top5Gated],
  )
  const total = categories.length

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    for (const c of categories) {
      const v = draft[c.id] ?? {}
      // Don't submit a top_5 set unless the podium is complete — otherwise the
      // user could persist 5 manual picks that bypass the auto-anchor rule.
      // Server treats a missing key as "delete", so stale top_5 rows get
      // cleaned up here.
      if (c.key === 'top_5' && top5Gated) continue
      if (c.valueKind === 'team' && v.teamId) {
        fd.append(`cat:${c.key}`, v.teamId)
      } else if (c.valueKind === 'team_set' && v.teamSet) {
        for (const t of v.teamSet) fd.append(`cat:${c.key}`, t)
      } else if (c.valueKind === 'player' && v.playerText) {
        fd.append(`cat:${c.key}`, v.playerText)
      }
    }
    setSavePhase('saving')
    startTransition(async () => {
      const r = await submitPredictions(groupSlug, fd)
      if (r.ok) {
        toast.success('Predicciones guardadas')
        // Hold the success animation visible for a beat before navigating, so
        // the user sees the "¡Listo!" state instead of an abrupt jump.
        setSavePhase('success')
        setTimeout(() => {
          router.push(`/groups/${groupSlug}/comprobante`)
        }, 900)
      } else {
        setSavePhase('idle')
        toast.error(r.error)
      }
    })
  }

  function renderTeamPill(teamId: string | null | undefined, fallback: string) {
    if (!teamId) {
      return <span className="text-sm text-muted-foreground">{fallback}</span>
    }
    const t = teamById.get(teamId)
    if (!t) return null
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium">
        <span className="text-base leading-none">{t.flagEmoji ?? '🏳️'}</span>
        {t.name}
        {t.fifaCode && (
          <span className="font-mono text-[11px] text-muted-foreground">{t.fifaCode}</span>
        )}
      </span>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <SavingOverlay
        phase={savePhase}
        icon={Trophy}
        savingTitle="Guardando tus predicciones"
        savingSubtitle="Un momento mientras dejamos todo registrado"
        successSubtitle="Preparando tu comprobante"
      />
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
          const top5Locked = c.key === 'top_5' && top5Gated
          const filled = !top5Locked && isFilled(c, v)
          const kindLabel =
            c.valueKind === 'player'
              ? 'JUGADOR'
              : c.valueKind === 'team_set'
                ? `${(c.metadata as { n?: number } | null)?.n ?? 2} EQUIPOS`
                : 'EQUIPO'
          const n = (c.metadata as { n?: number } | null)?.n ?? 2
          const perItem = (c.metadata as { scoring?: string } | null)?.scoring === 'per_match'
          const isFinalists = c.key === 'finalists'
          const isTop5 = c.key === 'top_5'

          return (
            <Card
              key={c.id}
              className={`animate-fade-up p-5 transition-colors ${filled ? 'border-accent/40' : 'border-border'} ${locked ? 'opacity-70' : ''}`}
              style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground tracking-wider">
                  {String(idx + 1).padStart(2, '0')} · {kindLabel}
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary tracking-wider"
                  title={
                    perItem
                      ? `${c.points} pts por cada acierto. Ganas puntos por cada equipo que aciertes aunque no aciertes todos.`
                      : undefined
                  }
                >
                  {c.points} PTS{perItem ? '/ACIERTO' : ''}
                  {perItem && <Info className="h-3 w-3 opacity-70" aria-hidden />}
                </span>
                {(isFinalists || (isTop5 && lockedTop5.length > 0)) && (
                  <Badge className="gap-1 border-primary/30 bg-primary/10 text-primary">
                    <Lock className="h-3 w-3" /> Auto
                  </Badge>
                )}
                {filled && !isFinalists && (
                  <Badge className="gap-1 border-accent/30 bg-accent/15 text-accent">
                    <Check className="h-3 w-3" /> Listo
                  </Badge>
                )}
              </div>
              <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                {c.name}
                {FIFA_RANKING_CATEGORIES.has(c.key) && <RevelationCriteriaDialog />}
                {PLAYER_MANUAL_CATEGORIES.has(c.key as PlayerCategoryKey) && (
                  <PlayerCategoryCriteriaDialog kind={c.key as PlayerCategoryKey} />
                )}
              </h3>
              {c.description && (
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {c.description}
                </p>
              )}

              <div className="mt-4 space-y-3">
                {c.valueKind === 'team' && (
                  <>
                    <TeamComboBox
                      teams={teams}
                      value={v.teamId ?? null}
                      onChange={(id) => update(c.id, { teamId: id })}
                      disabled={locked}
                      showRanking={FIFA_RANKING_CATEGORIES.has(c.key)}
                      excludeIds={podiumExcludesFor(c.key, draft, sourceIds)}
                      internalRanks={FIFA_RANKING_CATEGORIES.has(c.key) ? internalRanks : undefined}
                    />
                    {warningsFor(c.key, v.teamId, {
                      draft,
                      sourceIds,
                      revelationId,
                      disappointmentId,
                      top5Id,
                      topFavoriteIds,
                      bottomFavoriteIds,
                    }).map((w, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: warning order is stable for a given pick
                      <MismatchWarning key={i} text={w} />
                    ))}
                    {c.key === 'revelation' && <RankingHelper kind="revelation" />}
                    {c.key === 'disappointment' && <RankingHelper kind="disappointment" />}
                  </>
                )}

                {isFinalists && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Se llena automáticamente con tu Campeón y Subcampeón. Edita esas dos
                        categorías para cambiar tus finalistas.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {renderTeamPill(lockedFromSources.champion, 'Selecciona tu Campeón')}
                      {renderTeamPill(lockedFromSources.runnerUp, 'Selecciona tu Subcampeón')}
                    </div>
                  </div>
                )}

                {isTop5 &&
                  (lockedTop5.length < 3 ? (
                    <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      <p className="text-xs leading-relaxed">
                        <span className="font-medium text-foreground">Falta llenar el podio.</span>{' '}
                        <span className="text-muted-foreground">
                          Esta categoría se desbloquea cuando elijas tu Campeón, Subcampeón y Tercer
                          lugar. Esas 3 selecciones se anclan automáticamente al Top 5, y después
                          podrás elegir las otras 2 manualmente.
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Tu Campeón, Subcampeón y Tercer lugar ya cuentan acá (no se pueden
                          quitar). Elige las otras 2 selecciones que crees que llegarán más lejos.
                        </p>
                      </div>
                      <TeamSetGrid
                        teams={teams}
                        selected={v.teamSet ?? []}
                        onChange={(next) => update(c.id, { teamSet: next })}
                        n={n}
                        disabled={locked}
                        lockedTeamIds={lockedTop5}
                      />
                    </div>
                  ))}

                {c.valueKind === 'team_set' && !isFinalists && !isTop5 && n === 2 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[0, 1].map((i) => (
                      <div key={i}>
                        <p className="mb-1 text-xs text-muted-foreground">
                          Selección {String.fromCharCode(65 + i)}
                        </p>
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
                    ))}
                  </div>
                )}

                {c.valueKind === 'team_set' && !isFinalists && !isTop5 && n > 2 && (
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
                    <PlayerComboBox
                      players={players}
                      value={v.playerText ?? ''}
                      onChange={(next) => update(c.id, { playerText: next })}
                      disabled={locked}
                      minDob={c.key === 'young_player' ? YOUNG_PLAYER_MIN_DOB : undefined}
                      position={c.key === 'golden_glove' ? 'GK' : undefined}
                      placeholder={
                        c.key === 'young_player'
                          ? 'Buscar jugador sub-21 o escribir nombre…'
                          : c.key === 'golden_glove'
                            ? 'Buscar arquero o escribir nombre…'
                            : 'Buscar jugador o escribir nombre…'
                      }
                      suggestedNamePatterns={
                        PLAYER_MANUAL_CATEGORIES.has(c.key as PlayerCategoryKey)
                          ? PLAYER_SUGGESTIONS[c.key as PlayerCategoryKey]
                          : undefined
                      }
                    />
                    {c.key === 'young_player' && (
                      <p className="text-xs text-muted-foreground">
                        Solo aparecen jugadores nacidos a partir del 1 de enero de 2005 (sub-21 al
                        inicio del Mundial).
                      </p>
                    )}
                    {c.key === 'golden_glove' && (
                      <p className="text-xs text-muted-foreground">
                        Solo aparecen arqueros (GK) en la lista.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Si tu jugador no está en la lista, escribe su nombre y aparecerá una opción{' '}
                      <span className="font-medium text-foreground">"Usar: …"</span>. Verificaremos
                      manualmente al cierre del torneo contra el premio oficial FIFA.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {!locked && (
        <Card className="mt-5 hidden items-center justify-between gap-4 border-primary/20 bg-primary/5 p-5 sm:flex">
          <div>
            <p className="text-sm font-medium">Guardar mis predicciones</p>
            <p className="text-xs text-muted-foreground">
              {completed === total
                ? `¡Listo! Tienes las ${total} categorías completas.`
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
