import 'server-only'
import { and, eq, inArray, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { unstable_cache } from 'next/cache'
import { db } from '@/db'
import { matches, teams } from '@/db/schema'

export type BoringMatchView = {
  home: { name: string; flagEmoji: string | null; fifaCode: string }
  away: { name: string; flagEmoji: string | null; fifaCode: string }
  group: string
  dateLabel: string
  timeLabel: string
}

// Cinco "partidos aburridos" del Mundial 2026 — exactamente los mismos que
// usamos en el copy del login ("Da flojera adivinar Congo vs Uzbekistán...")
// pero ahora con cards estilo Google match preview. Datos confirmados via
// FIFA + ESPN + MLSSoccer + FOX Sports.
const BORING_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['HAI', 'SCO'],
  ['IRN', 'NZL'],
  ['JOR', 'ALG'],
  ['CPV', 'KSA'],
  ['COD', 'UZB'],
]

const FALLBACK_DATA: BoringMatchView[] = [
  {
    home: { name: 'Haití', flagEmoji: '🇭🇹', fifaCode: 'HAI' },
    away: { name: 'Escocia', flagEmoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', fifaCode: 'SCO' },
    group: 'C',
    dateLabel: 'Sáb, 13/6',
    timeLabel: '9:00 p.m.',
  },
  {
    home: { name: 'Irán', flagEmoji: '🇮🇷', fifaCode: 'IRN' },
    away: { name: 'Nueva Zelanda', flagEmoji: '🇳🇿', fifaCode: 'NZL' },
    group: 'G',
    dateLabel: 'Mar, 16/6',
    timeLabel: '12:00 a.m.',
  },
  {
    home: { name: 'Jordania', flagEmoji: '🇯🇴', fifaCode: 'JOR' },
    away: { name: 'Argelia', flagEmoji: '🇩🇿', fifaCode: 'ALG' },
    group: 'J',
    dateLabel: 'Lun, 22/6',
    timeLabel: '11:00 p.m.',
  },
  {
    home: { name: 'Cabo Verde', flagEmoji: '🇨🇻', fifaCode: 'CPV' },
    away: { name: 'Arabia Saudita', flagEmoji: '🇸🇦', fifaCode: 'KSA' },
    group: 'H',
    dateLabel: 'Vie, 26/6',
    timeLabel: '8:00 p.m.',
  },
  {
    home: { name: 'RD del Congo', flagEmoji: '🇨🇩', fifaCode: 'COD' },
    away: { name: 'Uzbekistán', flagEmoji: '🇺🇿', fifaCode: 'UZB' },
    group: 'K',
    dateLabel: 'Sáb, 27/6',
    timeLabel: '7:30 p.m.',
  },
]

const SPANISH_DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function formatDateBOT(d: Date): string {
  // En zona La Paz / BOT. Sin libs extras, parseamos los componentes a mano.
  const parts = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  // weekday en español viene como "sáb." — normalizamos al formato del screenshot.
  const wd = get('weekday').replace('.', '')
  const day = get('day')
  const month = get('month')
  const cap = wd.charAt(0).toUpperCase() + wd.slice(1)
  return `${cap}, ${day}/${month}`
}

function formatTimeBOT(d: Date): string {
  const parts = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const h = get('hour')
  const m = get('minute')
  // dayPeriod viene como "p. m." en es-BO — normalizamos a "p.m."
  const period = get('dayPeriod').replace(/\s+/g, '').replace('.m.', '.m.').toLowerCase()
  return `${h}:${m} ${period}`
}

async function loadFromDb(): Promise<BoringMatchView[]> {
  const allCodes = BORING_PAIRS.flatMap((p) => [p[0], p[1]])
  const teamRows = await db
    .select({ id: teams.id, fifaCode: teams.fifaCode, name: teams.name, flagEmoji: teams.flagEmoji })
    .from(teams)
    .where(inArray(teams.fifaCode, allCodes))
  const teamByCode = new Map(teamRows.map((t) => [t.fifaCode, t]))

  const result: BoringMatchView[] = []
  const teamA = alias(teams, 'team_a')
  const teamB = alias(teams, 'team_b')

  for (let i = 0; i < BORING_PAIRS.length; i++) {
    const [aCode, bCode] = BORING_PAIRS[i]
    const fallback = FALLBACK_DATA[i]
    const aTeam = teamByCode.get(aCode)
    const bTeam = teamByCode.get(bCode)
    if (!aTeam || !bTeam) {
      result.push(fallback)
      continue
    }

    const match = await db
      .select({
        kickedOffAt: matches.kickedOffAt,
        groupName: matches.groupName,
        teamAName: teamA.name,
        teamAFlag: teamA.flagEmoji,
        teamACode: teamA.fifaCode,
        teamBName: teamB.name,
        teamBFlag: teamB.flagEmoji,
        teamBCode: teamB.fifaCode,
      })
      .from(matches)
      .innerJoin(teamA, eq(teamA.id, matches.teamAId))
      .innerJoin(teamB, eq(teamB.id, matches.teamBId))
      .where(
        or(
          and(eq(teamA.fifaCode, aCode), eq(teamB.fifaCode, bCode)),
          and(eq(teamA.fifaCode, bCode), eq(teamB.fifaCode, aCode)),
        ),
      )
      .limit(1)

    const row = match[0]
    if (!row || !row.kickedOffAt) {
      result.push(fallback)
      continue
    }
    result.push({
      home: { name: row.teamAName, flagEmoji: row.teamAFlag, fifaCode: row.teamACode ?? aCode },
      away: { name: row.teamBName, flagEmoji: row.teamBFlag, fifaCode: row.teamBCode ?? bCode },
      group: row.groupName ?? fallback.group,
      dateLabel: formatDateBOT(row.kickedOffAt),
      timeLabel: formatTimeBOT(row.kickedOffAt),
    })
  }
  return result
}

export const getBoringMatches = unstable_cache(
  async (): Promise<BoringMatchView[]> => {
    try {
      const fromDb = await loadFromDb()
      return fromDb
    } catch (e) {
      console.error('boring-matches: DB load failed, using fallback', e)
      return FALLBACK_DATA
    }
  },
  ['welcome-boring-matches-v1'],
  { revalidate: 3600 },
)
