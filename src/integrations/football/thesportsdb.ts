import { env } from '@/lib/env'
import type { FootballProvider, TournamentSnapshot } from './types'

const WORLD_CUP_LEAGUE_ID = '4429'
const WORLD_CUP_SEASON = '2026'

function baseUrl(): string {
  return env.FOOTBALL_API_BASE_URL ?? 'https://www.thesportsdb.com/api/v1/json/3'
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}/${path}`, {
    headers: { 'user-agent': 'mundial-pool/0.1' },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`thesportsdb ${path} failed: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

type TsdbEvent = {
  idEvent: string
  strHomeTeam: string
  strAwayTeam: string
  idHomeTeam: string
  idAwayTeam: string
  strHomeTeamBadge: string | null
  strAwayTeamBadge: string | null
  intHomeScore: string | null
  intAwayScore: string | null
  strStatus: string
  intRound: string
  dateEvent: string
}

type TsdbEventsResponse = { events: TsdbEvent[] | null }

export async function fetchWorldCupFixtures(): Promise<TsdbEvent[]> {
  const data = await fetchJson<TsdbEventsResponse>(
    `eventsseason.php?id=${WORLD_CUP_LEAGUE_ID}&s=${WORLD_CUP_SEASON}`,
  )
  return data.events ?? []
}

export const thesportsdbProvider: FootballProvider = {
  id: 'thesportsdb',
  async fetchTournamentSnapshot(): Promise<TournamentSnapshot> {
    return {
      isFinished: false,
      champion: null,
      runnerUp: null,
      thirdPlace: null,
      finalists: null,
      topScorer: null,
      topScoringTeam: null,
      mostConcededTeam: null,
      teamRuns: [],
      goldenBall: null,
      goldenGlove: null,
      bestYoungPlayer: null,
      fetchedAt: new Date().toISOString(),
    }
  },
}
