import type { FootballProvider, TournamentSnapshot } from './types'

export const mockProvider: FootballProvider = {
  id: 'mock',
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
