// Computes the post-tournament 1→48 ranking and derives revelation /
// disappointment from the FIFA pre-tournament ranking.
//
// The football provider is responsible for filling the input shape below.
// Once it does, planCategory('revelation' | 'disappointment') in
// src/server/resolution.ts calls computeRevelationAndDisappointment with
// it and writes the result into the `results` table.

export type TournamentTeamInput = {
  teamId: string
  teamName: string
  /** Pre-tournament FIFA ranking among the 48 participating teams (1 = best). */
  fifaRank: number
  /**
   * Reached round in the bracket. 'group' = eliminated in group stage.
   * 'r32' = lost in round of 32, etc. 'champion' / 'runner_up' / 'third' /
   * 'fourth' for the semis/final outcomes.
   */
  reached:
    | 'group'
    | 'r32'
    | 'r16'
    | 'qf'
    | 'fourth'
    | 'third'
    | 'runner_up'
    | 'champion'
  /** Group-stage stats — used for the 33-48 bracket and as a last-resort tiebreaker. */
  groupPoints: number
  groupGoalDiff: number
  groupGoalsFor: number
  /** Card totals across the whole tournament. Lower = better fair play. */
  yellowCards: number
  redCards: number
  /**
   * The elimination match — only present for teams that reached at least
   * the round of 32 (i.e. reached !== 'group' && reached !== 'champion').
   * For teams that lost in their knockout match, this is that match.
   */
  eliminationMatch?: {
    /** Went to a penalty shootout (i.e. drew in regulation + ET). */
    wentToPenalties: boolean
    /** Goals scored by THIS team in regulation + ET. */
    goalsFor: number
    /** Goals conceded by THIS team in regulation + ET. */
    goalsAgainst: number
  }
}

export type TeamRank = {
  teamId: string
  teamName: string
  fifaRank: number
  tournamentRank: number
  delta: number
}

// Numeric bracket index: lower = better, matches the table in the criteria
// dialog (1 = champion bracket, 5 = QF losers bracket, 8 = group-stage bracket).
function bracketOf(reached: TournamentTeamInput['reached']): number {
  switch (reached) {
    case 'champion':
      return 1
    case 'runner_up':
      return 2
    case 'third':
      return 3
    case 'fourth':
      return 4
    case 'qf':
      return 5
    case 'r16':
      return 6
    case 'r32':
      return 7
    case 'group':
      return 8
  }
}

function fairPlayScore(t: TournamentTeamInput): number {
  // Yellows + reds, lower is better. Reds count more because they affected
  // the team for the rest of the match too — weight ×2.
  return t.yellowCards + t.redCards * 2
}

// Compare two teams within the same knockout-loser bracket.
// Returns < 0 if a is "better positioned" than b (closer to position 5/9/17).
function compareKnockoutLosers(a: TournamentTeamInput, b: TournamentTeamInput): number {
  const am = a.eliminationMatch
  const bm = b.eliminationMatch
  // Should never happen for knockout losers, but stay defensive.
  if (!am || !bm) {
    if (!am && bm) return 1
    if (am && !bm) return -1
    return fairPlayScore(a) - fairPlayScore(b)
  }

  // 1. Penalty losers come first.
  if (am.wentToPenalties !== bm.wentToPenalties) {
    return am.wentToPenalties ? -1 : 1
  }

  if (am.wentToPenalties && bm.wentToPenalties) {
    // 2a. More goals in the match (regulation + ET).
    if (am.goalsFor !== bm.goalsFor) return bm.goalsFor - am.goalsFor
    // 2b. Fair play.
    return fairPlayScore(a) - fairPlayScore(b)
  }

  // Both lost in regulation/ET — order by margin, then GF, then fair play.
  const aDiff = am.goalsFor - am.goalsAgainst
  const bDiff = bm.goalsFor - bm.goalsAgainst
  if (aDiff !== bDiff) return bDiff - aDiff
  if (am.goalsFor !== bm.goalsFor) return bm.goalsFor - am.goalsFor
  return fairPlayScore(a) - fairPlayScore(b)
}

function compareGroupStageLosers(a: TournamentTeamInput, b: TournamentTeamInput): number {
  if (a.groupPoints !== b.groupPoints) return b.groupPoints - a.groupPoints
  if (a.groupGoalDiff !== b.groupGoalDiff) return b.groupGoalDiff - a.groupGoalDiff
  if (a.groupGoalsFor !== b.groupGoalsFor) return b.groupGoalsFor - a.groupGoalsFor
  return fairPlayScore(a) - fairPlayScore(b)
}

export function computeTournamentRanks(teams: TournamentTeamInput[]): TeamRank[] {
  // Group teams by bracket so we can sort each bracket independently.
  const byBracket = new Map<number, TournamentTeamInput[]>()
  for (const t of teams) {
    const b = bracketOf(t.reached)
    const arr = byBracket.get(b) ?? []
    arr.push(t)
    byBracket.set(b, arr)
  }

  const out: TeamRank[] = []
  let nextRank = 1
  for (let b = 1; b <= 8; b++) {
    const arr = byBracket.get(b) ?? []
    if (arr.length === 0) continue

    if (b <= 4) {
      // Single-team brackets (champion through 4th place). Order is fixed.
      for (const t of arr) {
        out.push({
          teamId: t.teamId,
          teamName: t.teamName,
          fifaRank: t.fifaRank,
          tournamentRank: nextRank,
          delta: t.fifaRank - nextRank,
        })
        nextRank++
      }
      continue
    }

    const sorted =
      b === 8 ? [...arr].sort(compareGroupStageLosers) : [...arr].sort(compareKnockoutLosers)
    for (const t of sorted) {
      out.push({
        teamId: t.teamId,
        teamName: t.teamName,
        fifaRank: t.fifaRank,
        tournamentRank: nextRank,
        delta: t.fifaRank - nextRank,
      })
      nextRank++
    }
  }
  return out
}

export type RevelationOutcome = {
  revelation: TeamRank
  disappointment: TeamRank
  ranks: TeamRank[]
}

// Returns null when the input is empty or when no eligible team exists.
export function computeRevelationAndDisappointment(
  teams: TournamentTeamInput[],
): RevelationOutcome | null {
  if (teams.length === 0) return null
  const ranks = computeTournamentRanks(teams)
  if (ranks.length === 0) return null

  // Revelation = max delta. Tiebreak by best tournamentRank reached
  // (i.e. who went further). Disappointment = min delta, same tiebreak.
  const sortedByDelta = [...ranks].sort((a, b) => {
    if (b.delta !== a.delta) return b.delta - a.delta
    return a.tournamentRank - b.tournamentRank
  })
  const revelation = sortedByDelta[0]
  const disappointment = sortedByDelta[sortedByDelta.length - 1]
  if (revelation === disappointment) return null
  return { revelation, disappointment, ranks }
}
