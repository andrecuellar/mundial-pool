// ESPN provider — fuente FREE y sin auth para los RESULTADOS del Mundial 2026
// (tabla de 48 selecciones + snapshot del torneo). Reemplaza a TheSportsDB,
// cuyo tier gratis va atrasado y no publica todos los partidos jugados.
//
// ESPN expone el calendario completo (104 partidos) vía un solo endpoint
// scoreboard, con resultado, estado, etapa y penales. Los goleadores siguen
// saliendo de espn-players.ts (mismo origen ESPN, endpoint de commentary).
//
// OJO: el scoreboard corta en 100 resultados sin `&limit`; el Mundial tiene
// 104 partidos. Sin el limit perderíamos semifinales/final cuando ESPN las
// publique.

import type {
  FootballProvider,
  RawMatch,
  RawMatchStage,
  ResolvedTeam,
  TeamTournamentRun,
  TournamentRound,
  TournamentSnapshot,
} from './types'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world'

// Rango del Mundial 2026 (group stage 11-jun → final 19-jul + buffer). Antes
// del 11-jun ESPN devuelve [] y no rompe nada (idempotente sobre vacío).
const WC_START = '20260611'
const WC_END = '20260720'
const SCOREBOARD_LIMIT = 500

// season.slug que entrega ESPN → etapa interna usada por la tabla `matches`.
const SLUG_TO_STAGE: Record<string, RawMatchStage> = {
  'group-stage': 'group',
  'round-of-32': 'r32',
  'round-of-16': 'r16',
  quarterfinals: 'qf',
  semifinals: 'sf',
  '3rd-place-match': 'third_place',
  final: 'final',
}

// Etapa interna → ronda del snapshot (furthestRound de cada selección).
const STAGE_TO_ROUND: Record<RawMatchStage, TournamentRound> = {
  group: 'group_stage',
  r32: 'round_of_32',
  r16: 'round_of_16',
  qf: 'quarter_finals',
  sf: 'semi_finals',
  third_place: 'semi_finals', // los del 3er puesto llegaron a semis
  final: 'final',
}

type EspnStatus = { type?: { completed?: boolean | null } | null } | null

type EspnCompetitor = {
  homeAway?: string | null
  score?: string | null
  shootoutScore?: string | number | null
  team?: { id?: string | null; displayName?: string | null } | null
}

type EspnCompetition = {
  status?: EspnStatus
  competitors?: EspnCompetitor[] | null
}

type EspnEvent = {
  id: string
  date?: string | null
  season?: { slug?: string | null } | null
  status?: EspnStatus
  competitions?: EspnCompetition[] | null
}

type Side = {
  name: string | null
  externalId: string | null
  score: number | null
  penalty: number | null
}

type NormMatch = {
  id: string
  stage: RawMatchStage
  date: Date | null
  finished: boolean
  home: Side
  away: Side
}

function parseDateOrNull(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseIntOrNull(s: string | number | null | undefined): number | null {
  if (s == null) return null
  const n = typeof s === 'number' ? s : Number.parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

function isCompleted(comp: EspnCompetition, event: EspnEvent): boolean {
  return (comp.status?.type?.completed ?? event.status?.type?.completed) === true
}

function toSide(c: EspnCompetitor | undefined, finished: boolean): Side {
  return {
    name: c?.team?.displayName ?? null,
    externalId: c?.team?.id ?? null,
    // Los partidos no jugados llegan con score "0": SOLO confiamos en el score
    // cuando el partido está terminado, si no contaríamos 0-0 falsos.
    score: finished ? parseIntOrNull(c?.score) : null,
    penalty: parseIntOrNull(c?.shootoutScore),
  }
}

async function fetchScoreboard(): Promise<EspnEvent[]> {
  const url = `${ESPN_BASE}/scoreboard?dates=${WC_START}-${WC_END}&limit=${SCOREBOARD_LIMIT}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`espn /scoreboard failed: HTTP ${res.status}`)
  const data = (await res.json()) as { events?: EspnEvent[] | null }
  return data.events ?? []
}

function normalize(events: EspnEvent[]): NormMatch[] {
  const out: NormMatch[] = []
  for (const e of events) {
    const stage = SLUG_TO_STAGE[e.season?.slug ?? '']
    if (!stage) continue // slug desconocido → ignorar en lugar de romper
    const comp = e.competitions?.[0]
    if (!comp) continue
    const competitors = comp.competitors ?? []
    const home = competitors.find((c) => c.homeAway === 'home')
    const away = competitors.find((c) => c.homeAway === 'away')
    const finished = isCompleted(comp, e)
    out.push({
      id: e.id,
      stage,
      date: parseDateOrNull(e.date),
      finished,
      home: toSide(home, finished),
      away: toSide(away, finished),
    })
  }
  return out
}

function toRawMatch(m: NormMatch): RawMatch {
  return {
    externalId: `espn-${m.id}`,
    stage: m.stage,
    // ESPN scoreboard no expone el grupo (A-L). La tabla de 48 no lo usa y
    // boring-matches tiene fallback hardcodeado, así que va null.
    groupName: null,
    kickedOffAt: m.date,
    finishedAt: m.finished ? m.date : null,
    teamAExternalId: m.home.externalId,
    teamAName: m.home.name,
    teamBExternalId: m.away.externalId,
    teamBName: m.away.name,
    scoreA: m.home.score,
    scoreB: m.away.score,
    penaltyA: m.home.penalty,
    penaltyB: m.away.penalty,
  }
}

// --- Snapshot: agregación de la corrida de cada selección ---

function winnerName(m: NormMatch): string | null {
  if (!m.finished || m.home.score == null || m.away.score == null) return null
  if (m.home.score > m.away.score) return m.home.name
  if (m.home.score < m.away.score) return m.away.name
  if (m.home.penalty != null && m.away.penalty != null) {
    return m.home.penalty > m.away.penalty ? m.home.name : m.away.name
  }
  return null
}

function loserName(m: NormMatch): string | null {
  const w = winnerName(m)
  if (!w) return null
  return w === m.home.name ? m.away.name : m.home.name
}

function aggregateTeamRuns(matches: NormMatch[]): TeamTournamentRun[] {
  const runs = new Map<string, TeamTournamentRun>()
  const seed = (name: string | null) => {
    if (!name || runs.has(name)) return
    runs.set(name, {
      name,
      furthestRound: 'group_stage',
      goalsFor: 0,
      goalsAgainst: 0,
      eliminated: false,
    })
  }

  for (const m of matches) {
    seed(m.home.name)
    seed(m.away.name)
    if (!m.finished || m.home.score == null || m.away.score == null) continue
    const homeRun = m.home.name ? runs.get(m.home.name) : undefined
    const awayRun = m.away.name ? runs.get(m.away.name) : undefined
    if (homeRun) {
      homeRun.goalsFor += m.home.score
      homeRun.goalsAgainst += m.away.score
    }
    if (awayRun) {
      awayRun.goalsFor += m.away.score
      awayRun.goalsAgainst += m.home.score
    }
    if (m.stage !== 'group') {
      const round = STAGE_TO_ROUND[m.stage]
      if (homeRun) homeRun.furthestRound = round
      if (awayRun) awayRun.furthestRound = round
      const loser = loserName(m)
      const loserRun = loser ? runs.get(loser) : undefined
      if (loserRun) loserRun.eliminated = true
    }
  }

  return Array.from(runs.values())
}

function findTopByGoals(
  runs: TeamTournamentRun[],
  field: 'goalsFor' | 'goalsAgainst',
): { team: ResolvedTeam; goals: number } | null {
  let best: TeamTournamentRun | null = null
  for (const r of runs) {
    if (r[field] === 0) continue
    if (!best || r[field] > best[field]) best = r
  }
  return best ? { team: { name: best.name }, goals: best[field] } : null
}

export const espnProvider: FootballProvider = {
  id: 'espn',
  async fetchMatches(): Promise<RawMatch[]> {
    const events = await fetchScoreboard()
    return normalize(events).map(toRawMatch)
  },
  async fetchTournamentSnapshot(): Promise<TournamentSnapshot> {
    const events = await fetchScoreboard()
    const matches = normalize(events)
    const runs = aggregateTeamRuns(matches)

    const finalMatch = matches.find((m) => m.stage === 'final')
    const champion = finalMatch ? winnerName(finalMatch) : null
    const runnerUp = finalMatch ? loserName(finalMatch) : null
    const finalHome = finalMatch?.home.name
    const finalAway = finalMatch?.away.name
    const finalists: [ResolvedTeam, ResolvedTeam] | null =
      finalHome && finalAway ? [{ name: finalHome }, { name: finalAway }] : null

    const thirdMatch = matches.find((m) => m.stage === 'third_place')
    const thirdPlace = thirdMatch ? winnerName(thirdMatch) : null

    const topScoringTeam = findTopByGoals(runs, 'goalsFor')
    const mostConcededTeam = findTopByGoals(runs, 'goalsAgainst')

    return {
      isFinished: champion !== null,
      champion: champion ? { name: champion } : null,
      runnerUp: runnerUp ? { name: runnerUp } : null,
      thirdPlace: thirdPlace ? { name: thirdPlace } : null,
      finalists,
      topScorer: null,
      topScoringTeam,
      mostConcededTeam: mostConcededTeam
        ? { team: mostConcededTeam.team, goalsAgainst: mostConcededTeam.goals }
        : null,
      teamRuns: runs,
      goldenBall: null,
      goldenGlove: null,
      bestYoungPlayer: null,
      fetchedAt: new Date().toISOString(),
    }
  },
}
