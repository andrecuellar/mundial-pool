import 'server-only'
import { unstable_cache } from 'next/cache'
import { db } from '@/db'
import { matches, players, teams } from '@/db/schema'

// Determina qué predicciones ya son matemáticamente imposibles ("muertas")
// aunque la categoría todavía no esté resuelta: p.ej. apostar a Portugal
// campeón cuando Portugal ya quedó eliminada. Se calcula desde el estado real
// del bracket (tabla `matches` + `teams.reachedRound`), que el cron diario de
// /api/cron/resolve mantiene al día — por eso la "muerte" de picks avanza
// sola cada día sin ningún job adicional.
//
// Regla de oro: SOLO se marca muerto lo 100% imposible. Ante cualquier duda
// (empates, datos incompletos, jugador no matcheado) el pick sigue "vivo".

export type TeamFate = {
  /** Puede ganar la final (no perdió ningún cruce ni quedó fuera en grupos). */
  canBeChampion: boolean
  /** Puede llegar a la final → sigue vivo para subcampeón y finalistas. */
  canReachFinal: boolean
  /** Puede ganar el partido por el tercer puesto. */
  canBeThird: boolean
  /** Puede terminar en el top 5 del ranking del torneo (semifinalistas + mejor perdedor de QF). */
  canBeTop5: boolean
  /** Le quedan partidos por jugar → sus goles a favor/en contra no están congelados. */
  stillPlaying: boolean
  /** Goles a favor en todo el torneo (sin definiciones por penales). */
  goalsFor: number
  /** Goles en contra en todo el torneo. */
  goalsAgainst: number
}

export type EliminationContext = {
  fatesByTeamId: Record<string, TeamFate>
  maxGoalsFor: number
  maxGoalsAgainst: number
  /** Nombre normalizado → candidatos (puede haber homónimos; se matan solo si TODOS están muertos). */
  playersByNormName: Record<string, { teamId: string | null; goals: number; assists: number }[]>
  maxPlayerGoals: number
  maxPlayerAssists: number
}

/**
 * Misma normalización que usa la vista v_user_scores para comparar
 * player_text: lower(regexp_replace(x, '[^a-z0-9]', '', 'gi')). Mantenerlas
 * idénticas garantiza que nunca marquemos muerto un pick que la vista después
 * puntuaría como correcto.
 */
export function normalizePlayerText(s: string): string {
  return s.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

type MatchRow = {
  stage: string
  teamAId: string | null
  teamBId: string | null
  scoreA: number | null
  scoreB: number | null
  penaltyA: number | null
  penaltyB: number | null
}

// null = partido sin jugar o empatado sin penales cargados aún (indecidido).
function winnerTeamId(m: MatchRow): string | null {
  if (m.scoreA == null || m.scoreB == null) return null
  if (m.scoreA > m.scoreB) return m.teamAId
  if (m.scoreA < m.scoreB) return m.teamBId
  if (m.penaltyA == null || m.penaltyB == null) return null
  return m.penaltyA > m.penaltyB ? m.teamAId : m.teamBId
}

async function computeEliminationContext(): Promise<EliminationContext> {
  const [matchRows, teamRows, playerRows] = await Promise.all([
    db
      .select({
        stage: matches.stage,
        teamAId: matches.teamAId,
        teamBId: matches.teamBId,
        scoreA: matches.scoreA,
        scoreB: matches.scoreB,
        penaltyA: matches.penaltyA,
        penaltyB: matches.penaltyB,
      })
      .from(matches),
    db.select({ id: teams.id, reachedRound: teams.reachedRound }).from(teams),
    db
      .select({
        fullName: players.fullName,
        teamId: players.teamId,
        goals: players.goals,
        assists: players.assists,
      })
      .from(players),
  ])

  type Acc = { goalsFor: number; goalsAgainst: number; lostAt: Set<string>; wonSf: boolean }
  const accs = new Map<string, Acc>()
  const accOf = (teamId: string): Acc => {
    let a = accs.get(teamId)
    if (!a) {
      a = { goalsFor: 0, goalsAgainst: 0, lostAt: new Set(), wonSf: false }
      accs.set(teamId, a)
    }
    return a
  }

  for (const m of matchRows) {
    if (!m.teamAId || !m.teamBId) continue
    if (m.scoreA == null || m.scoreB == null) continue
    const a = accOf(m.teamAId)
    const b = accOf(m.teamBId)
    a.goalsFor += m.scoreA
    a.goalsAgainst += m.scoreB
    b.goalsFor += m.scoreB
    b.goalsAgainst += m.scoreA

    if (m.stage === 'group') continue
    const winner = winnerTeamId(m)
    if (!winner) continue
    const loser = winner === m.teamAId ? m.teamBId : m.teamAId
    accOf(loser).lostAt.add(m.stage)
    if (m.stage === 'sf') accOf(winner).wonSf = true
  }

  const fatesByTeamId: Record<string, TeamFate> = {}
  let maxGoalsFor = 0
  let maxGoalsAgainst = 0
  for (const t of teamRows) {
    const acc = accs.get(t.id) ?? {
      goalsFor: 0,
      goalsAgainst: 0,
      lostAt: new Set<string>(),
      wonSf: false,
    }
    // 'group' lo asigna el cron de standings: un equipo eliminado en fase de
    // grupos no aparece en ningún cruce, así que no se puede deducir solo de
    // `matches` sin conocer el fixture completo del bracket.
    const groupElim = t.reachedRound === 'group'
    const lost = (s: string) => acc.lostAt.has(s)
    const outOfBracket = groupElim || lost('r32') || lost('r16') || lost('qf') || lost('sf')
    const canBeChampion = !outOfBracket && !lost('final')
    const canReachFinal = !outOfBracket
    // Tercer puesto: lo juegan los perdedores de semis. Ganar la semi (ir a la
    // final) también te saca de esta categoría.
    const canBeThird =
      !groupElim &&
      !lost('r32') &&
      !lost('r16') &&
      !lost('qf') &&
      !acc.wonSf &&
      !lost('third_place')
    // Top 5 = campeón, subcampeón, 3.º, 4.º y el mejor perdedor de cuartos.
    // Perder en r16 o antes te deja en el puesto 9 o peor.
    const canBeTop5 = !groupElim && !lost('r32') && !lost('r16')
    // Cubre a los finalistas y a los perdedores de semis (les queda el partido
    // por el 3.er puesto). Si es false, sus goles quedaron congelados.
    const stillPlaying = canBeChampion || canBeThird
    fatesByTeamId[t.id] = {
      canBeChampion,
      canReachFinal,
      canBeThird,
      canBeTop5,
      stillPlaying,
      goalsFor: acc.goalsFor,
      goalsAgainst: acc.goalsAgainst,
    }
    if (acc.goalsFor > maxGoalsFor) maxGoalsFor = acc.goalsFor
    if (acc.goalsAgainst > maxGoalsAgainst) maxGoalsAgainst = acc.goalsAgainst
  }

  const playersByNormName: EliminationContext['playersByNormName'] = {}
  let maxPlayerGoals = 0
  let maxPlayerAssists = 0
  for (const p of playerRows) {
    const key = normalizePlayerText(p.fullName)
    if (!key) continue
    const arr = playersByNormName[key] ?? []
    arr.push({ teamId: p.teamId, goals: p.goals, assists: p.assists })
    playersByNormName[key] = arr
    if (p.goals > maxPlayerGoals) maxPlayerGoals = p.goals
    if (p.assists > maxPlayerAssists) maxPlayerAssists = p.assists
  }

  return {
    fatesByTeamId,
    maxGoalsFor,
    maxGoalsAgainst,
    playersByNormName,
    maxPlayerGoals,
    maxPlayerAssists,
  }
}

// Cross-request cache con las mismas tags que invalidan los crons diarios:
// updateTeamStandings → 'teams', syncPlayerStats → 'players'.
export const getEliminationContext = unstable_cache(
  computeEliminationContext,
  ['elimination-context'],
  { revalidate: 3600, tags: ['teams', 'players'] },
)

/**
 * ¿El equipo elegido ya no puede ganar esta categoría? Para las categorías que
 * dependen del ranking final global (revelación/decepción) o de premios FIFA
 * nunca devuelve true — no son decidibles antes de la resolución.
 */
export function isTeamPickDead(
  categoryKey: string,
  teamId: string,
  ctx: EliminationContext,
): boolean {
  const fate = ctx.fatesByTeamId[teamId]
  if (!fate) return false
  switch (categoryKey) {
    case 'champion':
      return !fate.canBeChampion
    case 'runner_up':
    case 'finalists':
      return !fate.canReachFinal
    case 'third_place':
      return !fate.canBeThird
    case 'top_5':
      return !fate.canBeTop5
    case 'top_scoring_team':
      // Congelado y estrictamente por debajo del líder actual → nunca lo alcanza.
      // Un empate no mata: el desempate lo decide la resolución oficial.
      return !fate.stillPlaying && fate.goalsFor < ctx.maxGoalsFor
    case 'most_conceded_team':
      return !fate.stillPlaying && fate.goalsAgainst < ctx.maxGoalsAgainst
    default:
      return false
  }
}

/**
 * ¿El jugador elegido ya no puede ganar Bota de Oro / Máximo Asistente? Muerto
 * solo si su selección ya no juega Y otro jugador tiene estrictamente más
 * goles/asistencias. Si el texto no matchea ningún jugador conocido, vivo.
 */
export function isPlayerPickDead(
  categoryKey: string,
  playerText: string,
  ctx: EliminationContext,
): boolean {
  if (categoryKey !== 'top_scorer_player' && categoryKey !== 'top_assists_player') return false
  const candidates = ctx.playersByNormName[normalizePlayerText(playerText)]
  if (!candidates || candidates.length === 0) return false
  return candidates.every((p) => {
    if (!p.teamId) return false
    const fate = ctx.fatesByTeamId[p.teamId]
    if (!fate || fate.stillPlaying) return false
    return categoryKey === 'top_scorer_player'
      ? p.goals < ctx.maxPlayerGoals
      : p.assists < ctx.maxPlayerAssists
  })
}

/**
 * ¿La predicción completa ya no puede sumar NI UN punto? Para team_set basta
 * con que un solo equipo siga vivo para que el pick siga pendiente (puntúa por
 * acierto individual).
 */
export function isPickDead(
  cat: { key: string; valueKind: 'team' | 'player' | 'team_set' },
  pick: { teamId: string | null; teamSet: string[] | null; playerText: string | null },
  ctx: EliminationContext,
): boolean {
  if (cat.valueKind === 'team') {
    return pick.teamId ? isTeamPickDead(cat.key, pick.teamId, ctx) : false
  }
  if (cat.valueKind === 'team_set') {
    const set = pick.teamSet ?? []
    return set.length > 0 && set.every((id) => isTeamPickDead(cat.key, id, ctx))
  }
  return pick.playerText ? isPlayerPickDead(cat.key, pick.playerText, ctx) : false
}
