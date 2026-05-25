import { env } from '@/lib/env'
import { mockProvider } from './mock'
import type { FootballProvider } from './types'

export function getFootballProvider(): FootballProvider {
  switch (env.FOOTBALL_API_PROVIDER) {
    case 'mock':
      return mockProvider
    case 'api-football':
    case 'football-data':
      throw new Error(
        `Provider "${env.FOOTBALL_API_PROVIDER}" not implemented yet. Add adapter under src/integrations/football/.`,
      )
  }
}

export type { FootballProvider, TournamentSnapshot } from './types'
