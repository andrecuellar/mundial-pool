import 'server-only'

import { eq } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { db } from '@/db'
import { appState, teams } from '@/db/schema'
import { getEliminationContext, normalizePlayerText } from '@/features/tournament/eliminations'

// Probabilidad de que cada candidato GANE su categoría, calculada del estado
// real del torneo. Con la final a un partido, casi todo está sentenciado: lo que
// aún puede cambiar (campeón entre los 2 finalistas, goleador si un jugador que
// juega la final alcanza al líder) se modela; lo decidido va a 100%/0%; y las
// categorías de jurado (balón/guante/joven de oro) no se modelan (no hay %).
//
// El único input externo son las cuotas de campeón entre los 2 finalistas, que
// el admin edita (appState) — por defecto se derivan del ranking FIFA.

export const FINAL_ODDS_KEY = 'final_champion_odds'

export type WinProbabilities = {
  /** categoryKey → nombre de equipo → probabilidad 0..1 (equipos y team_sets). */
  byTeam: Record<string, Record<string, number>>
  /** categoryKey → nombre de jugador normalizado → probabilidad 0..1. */
  byPlayer: Record<string, Record<string, number>>
  /** Metadatos para el admin: los 2 finalistas y su prob de campeón (0..100). */
  finalOdds: { teamId: string; teamName: string; pct: number }[]
}

// Prob de anotar >= k goles en UN partido (heurístico simple para "alcanzar al
// líder en la final"). Decae rápido: un jugador/equipo raramente mete 3+ en un
// partido de final.
function scoreAtLeast(k: number): number {
  if (k <= 0) return 0.5 // empate → lo decide el desempate oficial, ~50/50
  const table = [0.5, 0.32, 0.13, 0.04, 0.015, 0.005]
  return table[Math.min(k, table.length - 1)]
}

function normalize(m: Record<string, number>): Record<string, number> {
  const sum = Object.values(m).reduce((a: number, b: number) => a + b, 0)
  if (sum <= 0) return m
  const out: Record<string, number> = {}
  for (const k in m) out[k] = m[k] / sum
  return out
}

const compute = async (): Promise<WinProbabilities> => {
  const [teamRows, ctx, oddsRow] = await Promise.all([
    db
      .select({
        id: teams.id,
        name: teams.name,
        reachedRound: teams.reachedRound,
        fifaRanking: teams.fifaRanking,
      })
      .from(teams),
    getEliminationContext(),
    db.query.appState.findFirst({ where: eq(appState.key, FINAL_ODDS_KEY) }),
  ])
  const nameById = new Map(teamRows.map((t) => [t.id, t.name]))
  const byTeam: Record<string, Record<string, number>> = {}
  const byPlayer: Record<string, Record<string, number>> = {}
  const setTeam = (cat: string, teamId: string, p: number) => {
    const name = nameById.get(teamId)
    if (!name) return
    ;(byTeam[cat] ??= {})[name] = p
  }

  // --- Finalistas y cuotas de campeón (editables por admin, default por FIFA) ---
  const finalists = teamRows.filter((t) => t.reachedRound === 'alive_final')
  let overrides: Record<string, number> | null = null
  if (oddsRow) {
    try {
      overrides = JSON.parse(oddsRow.value) as Record<string, number>
    } catch {
      overrides = null
    }
  }
  const championByTeamId: Record<string, number> = {}
  if (finalists.length === 2) {
    const raw = finalists.map((t) => {
      const ov = overrides?.[t.id]
      if (typeof ov === 'number' && ov > 0) return { id: t.id, w: ov }
      // Default: mejor ranking FIFA (número más bajo) → mayor peso. Suave.
      const rank = t.fifaRanking ?? 20
      return { id: t.id, w: 1 / Math.max(1, rank) }
    })
    const total = raw.reduce((a, b) => a + b.w, 0) || 1
    for (const r of raw) championByTeamId[r.id] = r.w / total
  } else if (finalists.length === 1) {
    championByTeamId[finalists[0].id] = 1
  }

  // champion / runner_up: entre los finalistas; el resto (eliminados) es 0.
  for (const t of teamRows) {
    const champ = championByTeamId[t.id] ?? 0
    setTeam('champion', t.id, champ)
    // Subcampeón = perder la final = que gane el OTRO finalista.
    if (finalists.some((f) => f.id === t.id)) {
      const otherChamp = finalists
        .filter((f) => f.id !== t.id)
        .reduce((a, f) => a + (championByTeamId[f.id] ?? 0), 0)
      setTeam('runner_up', t.id, otherChamp)
    }
  }

  // third_place: ya jugado → el equipo con reachedRound 'third' es 100%.
  const third = teamRows.find((t) => t.reachedRound === 'third')
  if (third) {
    setTeam('third_place', third.id, 1)
  } else {
    // Aún no se jugó: reparte entre los que pueden ser terceros.
    const cands = teamRows.filter((t) => ctx.fatesByTeamId[t.id]?.canBeThird)
    for (const t of cands) setTeam('third_place', t.id, cands.length ? 1 / cands.length : 0)
  }

  // finalists (team_set): cada finalista tiene prob 1 de SER finalista.
  for (const f of finalists) setTeam('finalists', f.id, 1)

  // top_scoring_team / most_conceded_team: líder actual vs finalistas que aún
  // pueden sumar en la final.
  const goalsCat = (cat: string, valueOf: (id: string) => number, max: number) => {
    const scores: Record<string, number> = {}
    for (const t of teamRows) {
      const fate = ctx.fatesByTeamId[t.id]
      if (!fate) continue
      const g = valueOf(t.id)
      if (fate.stillPlaying) {
        // Puede sumar en la final: prob de alcanzar/pasar al líder.
        scores[t.id] = scoreAtLeast(max - g + 1)
      } else if (g >= max) {
        // Líder congelado: se mantiene salvo que un finalista lo pase.
        scores[t.id] = 1
      }
      // congelado por debajo del líder → 0 (no aparece)
    }
    const norm = normalize(scores)
    for (const id in norm) setTeam(cat, id, norm[id])
  }
  goalsCat('top_scoring_team', (id) => ctx.fatesByTeamId[id]?.goalsFor ?? 0, ctx.maxGoalsFor)
  goalsCat(
    'most_conceded_team',
    (id) => ctx.fatesByTeamId[id]?.goalsAgainst ?? 0,
    ctx.maxGoalsAgainst,
  )

  // top_5 (team_set): reparte prob de estar en el top-5 según si están vivos.
  // Los ya sentenciados en top (finalistas + 3° + 4°) → alto; borde → menor.
  const finalistIds = new Set(finalists.map((f) => f.id))
  const fourth = teamRows.find((t) => t.reachedRound === 'fourth')
  const lockedTop = new Set<string>([
    ...finalistIds,
    ...(third ? [third.id] : []),
    ...(fourth ? [fourth.id] : []),
  ])
  const top5Cands = teamRows.filter(
    (t) => lockedTop.has(t.id) || ctx.fatesByTeamId[t.id]?.canBeTop5,
  )
  for (const t of top5Cands) {
    setTeam('top_5', t.id, lockedTop.has(t.id) ? 0.98 : 0.3)
  }

  // --- Jugadores: goleador / asistencias ---
  const playerCat = (
    cat: string,
    statOf: (c: { goals: number; assists: number }) => number,
    max: number,
  ) => {
    const scores: Record<string, number> = {}
    for (const [norm, cands] of Object.entries(ctx.playersByNormName)) {
      const best = Math.max(...cands.map(statOf))
      const anyAlive = cands.some((c) => c.teamId && ctx.fatesByTeamId[c.teamId]?.stillPlaying)
      if (anyAlive) {
        scores[norm] = scoreAtLeast(max - best + 1)
      } else if (best >= max) {
        scores[norm] = 1
      }
    }
    const out = normalize(scores)
    byPlayer[cat] = out
  }
  playerCat('top_scorer_player', (c) => c.goals, ctx.maxPlayerGoals)
  playerCat('top_assists_player', (c) => c.assists, ctx.maxPlayerAssists)

  const finalOdds = finalists.map((f) => ({
    teamId: f.id,
    teamName: f.name,
    pct: Math.round((championByTeamId[f.id] ?? 0) * 100),
  }))

  return { byTeam, byPlayer, finalOdds }
}

// Cacheado como el resto: se recalcula cuando cambian standings/players o el
// admin edita las cuotas (revalidateTag('teams')/('odds')).
export const getWinProbabilities = unstable_cache(compute, ['win-probabilities-v1'], {
  revalidate: 300,
  tags: ['teams', 'players', 'odds'],
})

/** Probabilidad (0..1) de que un pick concreto gane su categoría, o null si la
 *  categoría no se modela (jurado/subjetiva). */
export function probabilityForPick(
  probs: WinProbabilities,
  categoryKey: string,
  pick:
    | { kind: 'team'; teamName: string }
    | { kind: 'team_set'; teams: { name: string }[] }
    | { kind: 'player'; text: string }
    | { kind: 'empty' },
): number | null {
  if (pick.kind === 'empty') return null
  if (pick.kind === 'player') {
    const map = probs.byPlayer[categoryKey]
    if (!map) return null
    return map[normalizePlayerText(pick.text)] ?? 0
  }
  const map = probs.byTeam[categoryKey]
  if (!map) return null
  if (pick.kind === 'team') return map[pick.teamName] ?? 0
  // team_set: prob de que TODOS los elegidos sean correctos = producto.
  return pick.teams.reduce((acc, t) => acc * (map[t.name] ?? 0), 1)
}
