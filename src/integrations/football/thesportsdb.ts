import { env } from '@/lib/env'
import type {
  FootballProvider,
  ResolvedTeam,
  TeamTournamentRun,
  TournamentRound,
  TournamentSnapshot,
} from './types'

const WORLD_CUP_LEAGUE_ID = '4429'
const WORLD_CUP_SEASON = '2026'

const GROUP_ROUNDS = [1, 2, 3]
const KNOCKOUT_ROUNDS: { round: number; tag: TournamentRound }[] = [
  { round: 100, tag: 'round_of_32' },
  { round: 125, tag: 'round_of_16' },
  { round: 150, tag: 'quarter_finals' },
  { round: 175, tag: 'semi_finals' },
  { round: 200, tag: 'final' },
]
const THIRD_PLACE_ROUND = 180

type TsdbEvent = {
  idEvent: string
  strHomeTeam: string | null
  strAwayTeam: string | null
  intHomeScore: string | null
  intAwayScore: string | null
  intRound: string
  strStatus: string
  dateEvent: string | null
}

function baseUrl(): string {
  return env.FOOTBALL_API_BASE_URL ?? 'https://www.thesportsdb.com/api/v1/json/3'
}

async function fetchRound(round: number): Promise<TsdbEvent[]> {
  const url = `${baseUrl()}/eventsround.php?id=${WORLD_CUP_LEAGUE_ID}&r=${round}&s=${WORLD_CUP_SEASON}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`thesportsdb r=${round} failed: ${res.status}`)
  const data = (await res.json()) as { events: TsdbEvent[] | null }
  return data.events ?? []
}

function isFinished(event: TsdbEvent): boolean {
  if (event.intHomeScore == null || event.intAwayScore == null) return false
  return event.strStatus === 'Match Finished' || event.strStatus === 'FT'
}

function winnerOf(event: TsdbEvent): string | null {
  if (!isFinished(event)) return null
  const home = Number(event.intHomeScore)
  const away = Number(event.intAwayScore)
  if (home > away) return event.strHomeTeam
  if (away > home) return event.strAwayTeam
  return null
}

function loserOf(event: TsdbEvent): string | null {
  if (!isFinished(event)) return null
  const home = Number(event.intHomeScore)
  const away = Number(event.intAwayScore)
  if (home > away) return event.strAwayTeam
  if (away > home) return event.strHomeTeam
  return null
}

function aggregateTeamRuns(
  groupEvents: TsdbEvent[],
  knockoutEventsByRound: Map<TournamentRound, TsdbEvent[]>,
): TeamTournamentRun[] {
  const runs = new Map<string, TeamTournamentRun>()

  const seed = (name: string | null) => {
    if (!name) return
    if (!runs.has(name)) {
      runs.set(name, {
        name,
        furthestRound: 'group_stage',
        goalsFor: 0,
        goalsAgainst: 0,
        eliminated: false,
      })
    }
  }

  const addStats = (event: TsdbEvent) => {
    if (!event.strHomeTeam || !event.strAwayTeam) return
    seed(event.strHomeTeam)
    seed(event.strAwayTeam)
    if (event.intHomeScore == null || event.intAwayScore == null) return
    const home = Number(event.intHomeScore)
    const away = Number(event.intAwayScore)
    const homeRun = runs.get(event.strHomeTeam)
    const awayRun = runs.get(event.strAwayTeam)
    if (homeRun) {
      homeRun.goalsFor += home
      homeRun.goalsAgainst += away
    }
    if (awayRun) {
      awayRun.goalsFor += away
      awayRun.goalsAgainst += home
    }
  }

  for (const e of groupEvents) addStats(e)

  for (const [tag, events] of knockoutEventsByRound.entries()) {
    for (const e of events) {
      addStats(e)
      const home = runs.get(e.strHomeTeam ?? '')
      const away = runs.get(e.strAwayTeam ?? '')
      if (home) home.furthestRound = tag
      if (away) away.furthestRound = tag
      const loser = loserOf(e)
      if (loser) {
        const loserRun = runs.get(loser)
        if (loserRun) loserRun.eliminated = true
      }
    }
  }

  return Array.from(runs.values())
}

function findTopByGoals(
  runs: TeamTournamentRun[],
  field: 'goalsFor' | 'goalsAgainst',
): { team: ResolvedTeam; goals: number } | null {
  if (runs.length === 0) return null
  let best: TeamTournamentRun | null = null
  for (const r of runs) {
    if (r[field] === 0) continue
    if (!best || r[field] > best[field]) best = r
  }
  if (!best) return null
  return { team: { name: best.name }, goals: best[field] }
}

export const thesportsdbProvider: FootballProvider = {
  id: 'thesportsdb',
  async fetchTournamentSnapshot(): Promise<TournamentSnapshot> {
    const groupResults = await Promise.all(GROUP_ROUNDS.map(fetchRound))
    const groupEvents = groupResults.flat()

    const knockoutByTag = new Map<TournamentRound, TsdbEvent[]>()
    for (const { round, tag } of KNOCKOUT_ROUNDS) {
      const events = await fetchRound(round)
      if (events.length > 0) knockoutByTag.set(tag, events)
    }
    const thirdPlaceEvents = await fetchRound(THIRD_PLACE_ROUND)

    const runs = aggregateTeamRuns(groupEvents, knockoutByTag)

    const finals = knockoutByTag.get('final') ?? []
    const finalMatch = finals.find(isFinished) ?? null
    const finalScheduled = finals[0] ?? null

    const champion = finalMatch ? winnerOf(finalMatch) : null
    const runnerUp = finalMatch ? loserOf(finalMatch) : null
    const finalists: [ResolvedTeam, ResolvedTeam] | null = finalScheduled
      ? finalScheduled.strHomeTeam && finalScheduled.strAwayTeam
        ? [{ name: finalScheduled.strHomeTeam }, { name: finalScheduled.strAwayTeam }]
        : null
      : null

    const thirdPlaceMatch = thirdPlaceEvents.find(isFinished) ?? null
    const thirdPlace = thirdPlaceMatch ? winnerOf(thirdPlaceMatch) : null

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
