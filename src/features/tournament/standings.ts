import 'server-only'
import { eq, like } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { db } from '@/db'
import { matches as matchesTable, teams } from '@/db/schema'
import { teamMatchKey } from '@/integrations/football/normalize'
import type { RawMatch, RawMatchStage } from '@/integrations/football/types'

// Per-team accumulator used while we walk the matches. Mirrors the columns
// we persist on `teams`. `reachedRound` stays null for teams still alive in
// the tournament — the page treats null as "group bracket" so they show up
// among the group-stage finishers, but they'll resolve correctly once the
// tournament ends (every team gets a definitive reachedRound).
type TeamAgg = {
  groupPoints: number
  groupGoalDiff: number
  groupGoalsFor: number
  groupGoalsAgainst: number
  reachedRound: string | null
  elimMatchGoalsFor: number | null
  elimMatchGoalsAgainst: number | null
  elimMatchWentToPenalties: boolean
  lostInPenalties: boolean
}

function isFinalized(m: RawMatch): boolean {
  return m.scoreA != null && m.scoreB != null
}

function wentToPenalties(m: RawMatch): boolean {
  return m.penaltyA != null && m.penaltyB != null
}

// Returns 'A', 'B', or null (tied with no penalties yet → undecided).
function winnerSide(m: RawMatch): 'A' | 'B' | null {
  if (!isFinalized(m)) return null
  if (m.scoreA! > m.scoreB!) return 'A'
  if (m.scoreA! < m.scoreB!) return 'B'
  if (!wentToPenalties(m)) return null
  return m.penaltyA! > m.penaltyB! ? 'A' : 'B'
}

type ResolvedMatch = RawMatch & {
  teamAId: string | null
  teamBId: string | null
}

// El externalId lleva el prefijo del proveedor (`espn-...`, `tsdb-...`), así
// que la columna `source` se deriva de ahí sin acoplar esta función a un
// proveedor concreto.
function sourceFromExternalId(externalId: string): string {
  if (externalId.startsWith('espn-')) return 'espn'
  if (externalId.startsWith('tsdb-')) return 'thesportsdb'
  return 'unknown'
}

export async function updateTeamStandings(rawMatches: RawMatch[]): Promise<void> {
  // Idempotent on empty input. The mock provider returns [].
  if (rawMatches.length === 0) return

  // Limpieza de la migración TheSportsDB → ESPN: las filas viejas tienen
  // externalId `tsdb-...` y ya no se actualizan, así que las borramos para que
  // no queden duplicados de fixture en la tabla `matches`. No-op tras la
  // primera corrida con el provider de ESPN.
  await db.delete(matchesTable).where(like(matchesTable.externalId, 'tsdb-%'))

  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams)
  const nameToId = new Map<string, string>()
  for (const t of allTeams) nameToId.set(teamMatchKey(t.name), t.id)

  const resolved: ResolvedMatch[] = rawMatches.map((m) => ({
    ...m,
    teamAId: m.teamAName ? (nameToId.get(teamMatchKey(m.teamAName)) ?? null) : null,
    teamBId: m.teamBName ? (nameToId.get(teamMatchKey(m.teamBName)) ?? null) : null,
  }))

  // Upsert each match by externalId. Drizzle doesn't bulk-upsert with
  // per-row conflict updates as cleanly, so loop. 104 inserts max.
  for (const m of resolved) {
    await db
      .insert(matchesTable)
      .values({
        externalId: m.externalId,
        stage: m.stage,
        groupName: m.groupName,
        kickedOffAt: m.kickedOffAt,
        finishedAt: m.finishedAt,
        teamAId: m.teamAId,
        teamBId: m.teamBId,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        penaltyA: m.penaltyA,
        penaltyB: m.penaltyB,
        source: sourceFromExternalId(m.externalId),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: matchesTable.externalId,
        set: {
          stage: m.stage,
          groupName: m.groupName,
          kickedOffAt: m.kickedOffAt,
          finishedAt: m.finishedAt,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          penaltyA: m.penaltyA,
          penaltyB: m.penaltyB,
          updatedAt: new Date(),
        },
      })
  }

  const aggs = new Map<string, TeamAgg>()
  for (const t of allTeams) {
    aggs.set(t.id, {
      groupPoints: 0,
      groupGoalDiff: 0,
      groupGoalsFor: 0,
      groupGoalsAgainst: 0,
      reachedRound: null,
      elimMatchGoalsFor: null,
      elimMatchGoalsAgainst: null,
      elimMatchWentToPenalties: false,
      lostInPenalties: false,
    })
  }

  // Group stage aggregates.
  for (const m of resolved) {
    if (m.stage !== 'group') continue
    if (!isFinalized(m)) continue
    const a = m.teamAId
    const b = m.teamBId
    if (!a || !b) continue
    const aAgg = aggs.get(a)
    const bAgg = aggs.get(b)
    if (!aAgg || !bAgg) continue
    const sa = m.scoreA as number
    const sb = m.scoreB as number
    aAgg.groupGoalsFor += sa
    aAgg.groupGoalsAgainst += sb
    aAgg.groupGoalDiff = aAgg.groupGoalsFor - aAgg.groupGoalsAgainst
    bAgg.groupGoalsFor += sb
    bAgg.groupGoalsAgainst += sa
    bAgg.groupGoalDiff = bAgg.groupGoalsFor - bAgg.groupGoalsAgainst
    if (sa > sb) aAgg.groupPoints += 3
    else if (sa < sb) bAgg.groupPoints += 3
    else {
      aAgg.groupPoints += 1
      bAgg.groupPoints += 1
    }
  }

  // Index matches by stage and by team.
  const byStage = new Map<RawMatchStage, ResolvedMatch[]>()
  for (const m of resolved) {
    const arr = byStage.get(m.stage) ?? []
    arr.push(m)
    byStage.set(m.stage, arr)
  }

  const teamMatchAt = new Map<string, Map<RawMatchStage, ResolvedMatch>>()
  for (const m of resolved) {
    if (m.stage === 'group') continue
    for (const teamId of [m.teamAId, m.teamBId]) {
      if (!teamId) continue
      let map = teamMatchAt.get(teamId)
      if (!map) {
        map = new Map()
        teamMatchAt.set(teamId, map)
      }
      map.set(m.stage, m)
    }
  }

  // Final → champion / runner_up.
  const finalMatch = byStage.get('final')?.find(isFinalized)
  let championId: string | null = null
  let runnerUpId: string | null = null
  if (finalMatch && finalMatch.teamAId && finalMatch.teamBId) {
    const w = winnerSide(finalMatch)
    if (w === 'A') {
      championId = finalMatch.teamAId
      runnerUpId = finalMatch.teamBId
    } else if (w === 'B') {
      championId = finalMatch.teamBId
      runnerUpId = finalMatch.teamAId
    }
  }

  // Third place match → third / fourth.
  const thirdPlaceMatch = byStage.get('third_place')?.find(isFinalized)
  let thirdId: string | null = null
  let fourthId: string | null = null
  if (thirdPlaceMatch && thirdPlaceMatch.teamAId && thirdPlaceMatch.teamBId) {
    const w = winnerSide(thirdPlaceMatch)
    if (w === 'A') {
      thirdId = thirdPlaceMatch.teamAId
      fourthId = thirdPlaceMatch.teamBId
    } else if (w === 'B') {
      thirdId = thirdPlaceMatch.teamBId
      fourthId = thirdPlaceMatch.teamAId
    }
  }

  // Walk each team and decide reachedRound. Teams still alive remain null.
  for (const t of allTeams) {
    const agg = aggs.get(t.id)
    if (!agg) continue
    if (championId === t.id) {
      agg.reachedRound = 'champion'
      continue
    }
    if (runnerUpId === t.id) {
      agg.reachedRound = 'runner_up'
      continue
    }
    if (thirdId === t.id) {
      agg.reachedRound = 'third'
      continue
    }
    if (fourthId === t.id) {
      agg.reachedRound = 'fourth'
      continue
    }

    // SF loser waiting for third_place: leave null until that match resolves.
    const myKo = teamMatchAt.get(t.id)
    if (myKo?.has('sf') && !thirdPlaceMatch) continue

    // Knockout-stage losers (qf/r16/r32). Walk from latest to earliest.
    let assigned = false
    for (const stage of ['qf', 'r16', 'r32'] as const) {
      const m = myKo?.get(stage)
      if (!m || !isFinalized(m)) continue
      const w = winnerSide(m)
      if (!w) continue
      const mySide: 'A' | 'B' = m.teamAId === t.id ? 'A' : 'B'
      if (w === mySide) continue // they won this round, look at a later stage
      // They lost here.
      agg.reachedRound = stage
      const myGoals = mySide === 'A' ? (m.scoreA as number) : (m.scoreB as number)
      const theirGoals = mySide === 'A' ? (m.scoreB as number) : (m.scoreA as number)
      const wtp = wentToPenalties(m)
      agg.elimMatchGoalsFor = myGoals
      agg.elimMatchGoalsAgainst = theirGoals
      agg.elimMatchWentToPenalties = wtp
      agg.lostInPenalties = wtp
      assigned = true
      break
    }
    if (assigned) continue

    // No knockout loss found. If they played any finalized group match, mark
    // them as 'group'. Otherwise leave null (pre-Mundial or unknown).
    const playedGroup = resolved.some(
      (m) => m.stage === 'group' && isFinalized(m) && (m.teamAId === t.id || m.teamBId === t.id),
    )
    if (playedGroup) agg.reachedRound = 'group'
  }

  // Persist.
  for (const t of allTeams) {
    const a = aggs.get(t.id)
    if (!a) continue
    await db
      .update(teams)
      .set({
        reachedRound: a.reachedRound,
        groupPoints: a.groupPoints,
        groupGoalDiff: a.groupGoalDiff,
        groupGoalsFor: a.groupGoalsFor,
        groupGoalsAgainst: a.groupGoalsAgainst,
        lostInPenalties: a.lostInPenalties,
        elimMatchGoalsFor: a.elimMatchGoalsFor,
        elimMatchGoalsAgainst: a.elimMatchGoalsAgainst,
        elimMatchWentToPenalties: a.elimMatchWentToPenalties,
      })
      .where(eq(teams.id, t.id))
  }

  // Next 16: the second arg picks a cacheLife profile to apply to refreshed
  // entries. 'hours' matches the TTL set by the caller helpers.
  revalidateTag('teams', 'hours')
}
