import { env } from '@/lib/env'
import { espnProvider } from './espn'
import { mockProvider } from './mock'
import { thesportsdbProvider } from './thesportsdb'
import type { FootballProvider } from './types'

export function getFootballProvider(): FootballProvider {
  switch (env.FOOTBALL_API_PROVIDER) {
    case 'mock':
      return mockProvider
    case 'espn':
      return espnProvider
    case 'thesportsdb':
      return thesportsdbProvider
    case 'api-football':
    case 'football-data':
      throw new Error(
        `Provider "${env.FOOTBALL_API_PROVIDER}" not implemented yet. Add adapter under src/integrations/football/.`,
      )
  }
}

export type { FootballProvider, TournamentSnapshot } from './types'
