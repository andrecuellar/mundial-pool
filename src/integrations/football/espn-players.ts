// ESPN Deportes provider — fuente FREE y sin auth para goleadores Y asistentes
// del Mundial 2026.
//
// Workflow:
//   1) GET /scoreboard?dates=START-END → lista todos los partidos del Mundial
//      con su status (STATUS_FULL_TIME = terminado).
//   2) Para cada partido terminado: GET /summary?event=ID → trae el commentary
//      con la narración de cada jugada en texto.
//   3) Parseamos las líneas "Goal! ..." con regex para sacar:
//        - SCORER (jugador, equipo)
//        - ASSISTER (jugador, opcional; mismo equipo que el scorer)
//   4) Sumamos por jugador (scorer +1 gol, assister +1 asistencia).
//
// Comparado con worldcup26.ir (fuente anterior): ESPN tiene asistencias
// además de goles, nombres completos en lugar de "J. Quiñones", y es más
// estable. La free tier no requiere key (ESPN site.api.espn.com es público).

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world'

// Rango de fechas del Mundial 2026 (group stage 11-jun → final 19-jul + buffer).
// Si el cron corre antes del 11-jun, ESPN devolverá array vacío y no rompe.
const WC_START = '20260611'
const WC_END = '20260720'

type ScoreboardEvent = {
  id: string
  name: string
  status?: { type?: { name?: string | null } | null } | null
}

type CommentaryEntry = { text?: string | null; time?: { displayValue?: string | null } | null }

type Summary = { commentary?: CommentaryEntry[] | null }

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

// Captura: "Goal! TeamA X, TeamB Y. SCORER (Team) descripción..."
// Group 1 = scorer fullname, Group 2 = team del scorer.
// Los placeholders de equipo usan `.+?` (no una clase de caracteres) porque
// cualquier set explícito termina dejando afuera algún carácter de nombres de
// país: \w no matchea tildes ("Curaçao", "Türkiye") y \p{L} tampoco matchea el
// apóstrofe de "Côte d'Ivoire". Con `.+?` (no-greedy, anclado por ` \d+,` y
// ` \d+.`) andan todos sin enumerar caracteres.
const GOAL_RE = /Goal!\s+.+?\s+\d+,\s+.+?\s+\d+\.\s+([^(]+?)\s+\(([^)]+)\)/u

// Captura "Assisted by NAME" hasta el primer separador natural (with, following,
// after, coma, punto). Sin esto se incluye "with a cross" en el nombre.
const ASSIST_RE = /Assisted by\s+(.+?)(?=\s+(?:with|following|after)\b|[.,])/u

const OWN_GOAL_RE = /\bOwn\s+Goal\b/i

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function fetchEvents(): Promise<ScoreboardEvent[]> {
  // El scoreboard corta en 100 resultados sin `&limit`; el Mundial tiene 104
  // partidos, así que sin esto perderíamos goleadores de semis/final.
  const url = `${ESPN_BASE}/scoreboard?dates=${WC_START}-${WC_END}&limit=500`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`espn /scoreboard failed: HTTP ${res.status}`)
  const data = (await res.json()) as { events?: ScoreboardEvent[] }
  return data.events ?? []
}

async function fetchSummary(eventId: string): Promise<Summary> {
  const url = `${ESPN_BASE}/summary?event=${eventId}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`espn /summary?event=${eventId} failed: HTTP ${res.status}`)
  return (await res.json()) as Summary
}

type Agg = {
  fullName: string
  teamName: string
  goals: number
  assists: number
}

function bump(
  agg: Map<string, Agg>,
  fullName: string,
  teamName: string,
  field: 'goals' | 'assists',
) {
  const cleanName = fullName.trim()
  const cleanTeam = teamName.trim()
  if (!cleanName || !cleanTeam) return
  const key = `${slugify(cleanName)}|${slugify(cleanTeam)}`
  const prev = agg.get(key)
  if (prev) prev[field] += 1
  else agg.set(key, { fullName: cleanName, teamName: cleanTeam, goals: 0, assists: 0, [field]: 1 })
}

export async function fetchPlayerStats(): Promise<RawPlayerStat[]> {
  const events = await fetchEvents()
  const finished = events.filter((e) => e.status?.type?.name === 'STATUS_FULL_TIME')

  const agg = new Map<string, Agg>()

  // Secuencial para no martillar ESPN con un burst paralelo de ~64 calls.
  // Cada call demora ~100-300ms; 64 sequential ~ 10-20s, dentro del maxDuration
  // del cron (60s). Si llega a ser problema, paralelizar con un pool pequeño.
  for (const event of finished) {
    let summary: Summary
    try {
      summary = await fetchSummary(event.id)
    } catch (err) {
      console.error(`[player-stats] espn summary failed for ${event.id} (${event.name})`, err)
      continue
    }
    for (const c of summary.commentary ?? []) {
      const txt = c.text ?? ''
      if (!txt.includes('Goal!')) continue
      // ESPN marca los own goals en su propio detail type, pero por las dudas
      // descartamos cualquier "Goal!" que mencione "Own Goal" en el texto: el
      // gol cuenta para el equipo (no para el jugador) según las reglas
      // descritas en /torneo/jugadores.
      if (OWN_GOAL_RE.test(txt)) continue

      const goalMatch = GOAL_RE.exec(txt)
      if (!goalMatch) continue
      const scorerName = goalMatch[1]
      const teamName = goalMatch[2]
      bump(agg, scorerName, teamName, 'goals')

      const assistMatch = ASSIST_RE.exec(txt)
      if (assistMatch) {
        // El assister está en el mismo equipo que el scorer (regla universal
        // del fútbol: no podés asistirle a un jugador del otro equipo). ESPN
        // no nombra el equipo del assister explícitamente, así que reusamos.
        bump(agg, assistMatch[1], teamName, 'assists')
      }
    }
  }

  const out: RawPlayerStat[] = []
  for (const a of agg.values()) {
    out.push({
      externalId: `espn-${slugify(a.fullName)}-${slugify(a.teamName)}`,
      fullName: a.fullName,
      photoUrl: null,
      teamExternalId: null,
      teamName: a.teamName,
      goals: a.goals,
      assists: a.assists,
      minutesPlayed: 0,
      position: null,
    })
  }
  return out
}
