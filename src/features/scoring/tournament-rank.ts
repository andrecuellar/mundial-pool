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
  /**
   * Pre-tournament FIFA ranking normalized 1→48 across ONLY the participating
   * teams. The caller must rank the 48 World Cup teams by their global FIFA
   * rank and assign 1 to the best (lowest global rank) up to 48 to the worst.
   * This is intentional — using the raw global rank (e.g. New Zealand #85)
   * would give a fake +37 delta when they finish last in the tournament,
   * making them look like a "revelation" just for being the worst-ranked
   * participant. Normalizing to 1-48 prevents that.
   */
  fifaRank: number
  /**
   * Reached round in the bracket. 'group' = eliminated in group stage.
   * 'r32' = lost in round of 32, etc. 'champion' / 'runner_up' / 'third' /
   * 'fourth' for the semis/final outcomes.
   *
   * The 'alive_*' values are provisional and used only mid-tournament: they
   * mark a team still in the running by the round it is CURRENTLY IN (i.e. the
   * deepest round it has won, plus one). 'alive_r32' = qualified past groups but
   * hasn't won a knockout tie yet (also the pre-tournament default); 'alive_r16'
   * = won its round-of-32 tie and is now in the round of 16; and so on up to
   * 'alive_final'. A team alive at round R ranks ABOVE the team that lost at
   * round R (it hasn't lost and could go further) but BELOW anyone who reached a
   * deeper round — so reaching the quarterfinals and losing still beats being
   * alive in the round of 16. No team is 'alive_*' once the tournament ends, so
   * the final standings are unaffected.
   */
  reached:
    | 'group'
    | 'alive_r32'
    | 'r32'
    | 'alive_r16'
    | 'r16'
    | 'alive_qf'
    | 'qf'
    | 'alive_sf'
    | 'alive_final'
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

// Numeric bracket index: lower = better. Advancing a round outweighs being
// eliminated in a shallower one, so the still-in-the-running ('alive_*')
// brackets are interleaved with the knockout-loser brackets: a team alive at
// round R sits just above the team that lost at round R, but below anyone who
// reached a deeper round. All 'alive_*' brackets are provisional — they
// collapse to nothing once every team has a decided finish.
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
    case 'alive_final':
      return 5 // won the semifinal, in the final (top 2)
    case 'alive_sf':
      return 6 // won the quarterfinal, in the semifinals (top 4)
    case 'alive_qf':
      return 7 // won the round of 16, in the quarterfinals (top 8)
    case 'qf':
      return 8 // lost in the quarterfinals (5-8)
    case 'alive_r16':
      return 9 // won the round of 32, in the round of 16 (top 16)
    case 'r16':
      return 10 // lost in the round of 16 (9-16)
    case 'alive_r32':
      return 11 // qualified past groups, still in the round of 32 (top 32); pre-tournament default
    case 'r32':
      return 12 // lost in the round of 32 (17-32)
    case 'group':
      return 13 // eliminated in the group stage (33-48)
  }
}

// Brackets whose teams were eliminated in a knockout tie: they own an
// `eliminationMatch` and are ordered by it. Every other bracket in the 5-13
// range (the 'alive_*' provisional brackets and the group-stage bracket) is
// ordered by group-stage performance instead.
const KO_LOSS_BRACKETS = new Set([8, 10, 12])

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
  for (let b = 1; b <= 13; b++) {
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

    // Knockout-loser brackets are ordered by the elimination match; the
    // provisional 'alive_*' brackets and the group-stage bracket by group-stage
    // performance (alive teams have no elimination match).
    const sorted = KO_LOSS_BRACKETS.has(b)
      ? [...arr].sort(compareKnockoutLosers)
      : [...arr].sort(compareGroupStageLosers)
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

/** Subconjunto estructural de la fila de `teams` que necesita el ranking. */
export type TeamRowForRanking = {
  id: string
  name: string
  fifaRanking: number | null
  reachedRound: string | null
  groupPoints: number
  groupGoalDiff: number
  groupGoalsFor: number
  yellowCards: number
  redCards: number
  elimMatchGoalsFor: number | null
  elimMatchGoalsAgainst: number | null
  elimMatchWentToPenalties: boolean
}

const VALID_REACHED = new Set<TournamentTeamInput['reached']>([
  'group',
  'alive_r32',
  'r32',
  'alive_r16',
  'r16',
  'alive_qf',
  'qf',
  'alive_sf',
  'alive_final',
  'fourth',
  'third',
  'runner_up',
  'champion',
])

// Rondas definitivas: cuando TODOS los equipos tienen una de estas, el torneo
// terminó y el ranking 1→48 deja de ser provisional.
const FINAL_ROUNDS = new Set([
  'group',
  'r32',
  'r16',
  'qf',
  'fourth',
  'third',
  'runner_up',
  'champion',
])

/**
 * Construye el input del ranking desde las filas de `teams` que el cron de
 * standings mantiene. Normaliza el ranking FIFA global a 1..N entre los
 * participantes (ver doc de fifaRank arriba); equipos sin ranking FIFA van al
 * final en orden alfabético para mantener el resultado determinista.
 * `decided` = ya no queda ningún equipo en ronda provisional ('alive_*' o
 * null), es decir, la final y el tercer puesto ya se jugaron.
 */
export function buildTournamentInputs(rows: TeamRowForRanking[]): {
  inputs: TournamentTeamInput[]
  decided: boolean
} {
  const byFifa = [...rows].sort((a, b) => {
    if (a.fifaRanking != null && b.fifaRanking != null) return a.fifaRanking - b.fifaRanking
    if (a.fifaRanking != null) return -1
    if (b.fifaRanking != null) return 1
    return a.name.localeCompare(b.name, 'es')
  })
  const normFifa = new Map(byFifa.map((t, i) => [t.id, i + 1]))

  const inputs = rows.map((t) => {
    const reached = VALID_REACHED.has(t.reachedRound as TournamentTeamInput['reached'])
      ? (t.reachedRound as TournamentTeamInput['reached'])
      : 'alive_r32'
    const input: TournamentTeamInput = {
      teamId: t.id,
      teamName: t.name,
      fifaRank: normFifa.get(t.id) ?? rows.length,
      reached,
      groupPoints: t.groupPoints,
      groupGoalDiff: t.groupGoalDiff,
      groupGoalsFor: t.groupGoalsFor,
      yellowCards: t.yellowCards,
      redCards: t.redCards,
    }
    if (t.elimMatchGoalsFor != null && t.elimMatchGoalsAgainst != null) {
      input.eliminationMatch = {
        wentToPenalties: t.elimMatchWentToPenalties,
        goalsFor: t.elimMatchGoalsFor,
        goalsAgainst: t.elimMatchGoalsAgainst,
      }
    }
    return input
  })

  const decided =
    rows.length > 0 && rows.every((t) => t.reachedRound != null && FINAL_ROUNDS.has(t.reachedRound))
  return { inputs, decided }
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
