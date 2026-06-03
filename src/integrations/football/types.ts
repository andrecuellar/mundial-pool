export type ResolvedTeam = { name: string }

export type ResolvedPlayer = {
  externalId: string
  fullName: string
  teamName: string | null
}

export type TournamentRound =
  | 'group_stage'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_finals'
  | 'semi_finals'
  | 'final'

export type TeamTournamentRun = {
  name: string
  furthestRound: TournamentRound
  goalsFor: number
  goalsAgainst: number
  eliminated: boolean
}

export type TournamentSnapshot = {
  isFinished: boolean
  champion: ResolvedTeam | null
  runnerUp: ResolvedTeam | null
  thirdPlace: ResolvedTeam | null
  finalists: [ResolvedTeam, ResolvedTeam] | null
  topScorer: { player: ResolvedPlayer; goals: number } | null
  topScoringTeam: { team: ResolvedTeam; goals: number } | null
  mostConcededTeam: { team: ResolvedTeam; goalsAgainst: number } | null
  teamRuns: TeamTournamentRun[]
  goldenBall: ResolvedPlayer | null
  goldenGlove: ResolvedPlayer | null
  bestYoungPlayer: ResolvedPlayer | null
  fetchedAt: string
}

export type RawMatchStage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third_place' | 'final'

export type RawMatch = {
  externalId: string
  stage: RawMatchStage
  groupName: string | null
  kickedOffAt: Date | null
  finishedAt: Date | null
  teamAExternalId: string | null
  teamAName: string | null
  teamBExternalId: string | null
  teamBName: string | null
  scoreA: number | null
  scoreB: number | null
  penaltyA: number | null
  penaltyB: number | null
}

export interface FootballProvider {
  readonly id: string
  fetchTournamentSnapshot(): Promise<TournamentSnapshot>
  fetchMatches(): Promise<RawMatch[]>
}
