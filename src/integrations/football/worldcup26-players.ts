// worldcup26.ir provider — fuente FREE y sin auth para goleadores del Mundial 2026.
//
// El endpoint /get/games devuelve los 104 partidos. Cada game finalizado trae
// home_scorers / away_scorers como un string con formato de array de Postgres,
// con quoting inconsistente (a veces smart-quotes Unicode, a veces straight).
// Cada entrada es "Nombre del jugador MM'" con anotaciones opcionales (OG / pen.).
//
// Limitación importante: esta fuente NO tiene asistencias. La columna `assists`
// en la DB se quedará en 0 para todos los jugadores hasta que se agregue una
// fuente para asistencias (admin manual, FIFA al cierre del torneo, etc).
//
// API-Football free no fue viable: su free tier sólo da seasons 2022-2024.
// Verificado: GET /players/topscorers?league=1&season=2026 →
// "Free plans do not have access to this season".

const BASE_URL = 'https://worldcup26.ir'

type Game = {
  home_team_id: string
  away_team_id: string
  home_score: string | null
  away_score: string | null
  home_scorers: string | null
  away_scorers: string | null
  finished: string
  home_team_name_en: string | null
  away_team_name_en: string | null
}

type GamesResponse = { games: Game[] }

export type RawPlayerStat = {
  externalId: string
  fullName: string
  photoUrl: string | null
  teamExternalId: string | null
  teamName: string | null
  goals: number
  assists: number
  minutesPlayed: number
  position: string | null
}

// Saca las entradas (cada una entre cualquier par de comillas DOBLES). NO
// incluir single-quote en el set de delimitadores porque el API usa el
// apóstrofe (straight o curly) como marcador de minuto ("9'") y eso causaría
// que se trunquen los nombres. Comillas dobles que aceptamos: " " " " „ « »
function extractQuotedEntries(s: string): string[] {
  const inner = s.replace(/^\{/, '').replace(/\}$/, '')
  const re = /[\u0022\u201C\u201D\u201E\u00AB\u00BB]([^\u0022\u201C\u201D\u201E\u00AB\u00BB]+)[\u0022\u201C\u201D\u201E\u00AB\u00BB]/g
  const out: string[] = []
  for (const match of inner.matchAll(re)) {
    const piece = match[1].trim()
    if (piece) out.push(piece)
  }
  return out
}

type ScorerEvent = {
  playerName: string
  ownGoal: boolean
}

function parseScorerEntry(entry: string): ScorerEvent | null {
  // Detectar autogol: "(OG)", "(own goal)", "(autogol)".
  const ownGoal = /\((?:OG|own\s*goal|autogol)\)/i.test(entry)
  // Limpiar: quitar anotación entre paréntesis al final ((pen.), (OG), etc.),
  // y quitar el marcador de minuto "\d+(\+\d+)?'" (con apostrofe straight o
  // curly).
  const nameOnly = entry
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\s+\d+(?:\+\d+)?\s*[\u0027\u2019\u02BC]/g, '')
    .trim()
  if (!nameOnly) return null
  return { playerName: nameOnly, ownGoal }
}

function parseScorers(raw: string | null): ScorerEvent[] {
  if (!raw || raw === 'null' || raw.trim() === '') return []
  const entries = extractQuotedEntries(raw)
  const out: ScorerEvent[] = []
  for (const e of entries) {
    const parsed = parseScorerEntry(e)
    if (parsed) out.push(parsed)
  }
  return out
}

// Slugify normalizado para usar como parte del externalId estable. El API no
// expone un ID de jugador, así que el (slug, teamId) compuesto es la mejor
// clave estable que tenemos.
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function fetchGames(): Promise<Game[]> {
  const res = await fetch(`${BASE_URL}/get/games`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`worldcup26.ir /get/games failed: HTTP ${res.status}`)
  const data = (await res.json()) as GamesResponse
  return data.games ?? []
}

export async function fetchPlayerStats(): Promise<RawPlayerStat[]> {
  const games = await fetchGames()

  type Agg = {
    playerName: string
    teamName: string
    goals: number
  }
  const agg = new Map<string, Agg>()

  const accumulate = (events: ScorerEvent[], teamName: string | null) => {
    if (!teamName) return
    for (const ev of events) {
      // Los autogoles no cuentan para el jugador (regla descrita en la página
      // /torneo/jugadores). Sí cuentan para el marcador del partido, pero no
      // para la Bota de Oro.
      if (ev.ownGoal) continue
      const key = `${slugify(ev.playerName)}|${slugify(teamName)}`
      const prev = agg.get(key)
      if (prev) prev.goals += 1
      else agg.set(key, { playerName: ev.playerName, teamName, goals: 1 })
    }
  }

  for (const g of games) {
    if (g.finished !== 'TRUE') continue
    const homeEvents = parseScorers(g.home_scorers)
    const awayEvents = parseScorers(g.away_scorers)
    accumulate(homeEvents, g.home_team_name_en)
    accumulate(awayEvents, g.away_team_name_en)
  }

  const out: RawPlayerStat[] = []
  for (const a of agg.values()) {
    out.push({
      externalId: `wc26ir-${slugify(a.playerName)}-${slugify(a.teamName)}`,
      fullName: a.playerName,
      photoUrl: null,
      teamExternalId: null,
      teamName: a.teamName,
      goals: a.goals,
      // Esta fuente no expone asistencias.
      assists: 0,
      // Esta fuente no expone minutos jugados.
      minutesPlayed: 0,
      position: null,
    })
  }
  return out
}
