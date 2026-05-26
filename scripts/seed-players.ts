import { config } from 'dotenv'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { players, teams } from '../src/db/schema'
import { teamMatchKey } from '../src/integrations/football/normalize'

config({ path: '.env.local' })
config({ path: '.env' })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const WIKI_URL =
  'https://en.wikipedia.org/w/api.php?action=parse&page=2026_FIFA_World_Cup_squads&format=json&prop=wikitext'

type ParsedPlayer = {
  team: string // English team name from the Wikipedia section heading
  name: string
  position: string | null
  dateOfBirth: string | null
}

function stripWikiLinks(s: string): string {
  // [[link|display]] -> display ; [[link]] -> link
  return s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => (b ?? a).trim()).trim()
}

function parsePlayer(raw: string, team: string): ParsedPlayer | null {
  const nameMatch = raw.match(/\|\s*name\s*=\s*([^|}]+)/)
  if (!nameMatch) return null
  const name = stripWikiLinks(nameMatch[1])
  if (!name) return null

  const posMatch = raw.match(/\|\s*pos\s*=\s*([A-Z]+)/)
  const position = posMatch ? posMatch[1] : null

  const ageMatch = raw.match(
    /\{\{birth date(?: and age)?\s*(?:2|3)?\s*\|[^}]*?(\d{4})\|(\d{1,2})\|(\d{1,2})/i,
  )
  let dob: string | null = null
  if (ageMatch) {
    // The "birth date and age2" template is |2026|6|11|YYYY|MM|DD — the last
    // three numbers are the actual DOB. Match captured 1st YYYY/M/D, so we
    // need to handle both shapes by always taking the LAST date triple.
    const all = [...raw.matchAll(/(\d{4})\|(\d{1,2})\|(\d{1,2})/g)]
    if (all.length > 0) {
      const last = all[all.length - 1]
      const y = Number(last[1])
      if (y >= 1970 && y <= 2015) {
        const m = String(Number(last[2])).padStart(2, '0')
        const d = String(Number(last[3])).padStart(2, '0')
        dob = `${y}-${m}-${d}`
      }
    }
  }

  return { team, name, position, dateOfBirth: dob }
}

function parseAllPlayers(wikitext: string): ParsedPlayer[] {
  const out: ParsedPlayer[] = []
  // Walk line by line; track latest level-3 section heading as current team.
  const lines = wikitext.split('\n')
  let currentTeam: string | null = null
  let buf = ''
  let depth = 0
  for (const line of lines) {
    const hd = line.match(/^===\s*([^=]+?)\s*===\s*$/)
    if (hd) {
      currentTeam = stripWikiLinks(hd[1])
      continue
    }
    if (!currentTeam) continue
    // Accumulate template (templates can span lines).
    for (let i = 0; i < line.length; i++) {
      const two = line.slice(i, i + 2)
      if (two === '{{') {
        if (depth === 0) buf = ''
        depth++
        buf += '{{'
        i++
        continue
      }
      if (two === '}}') {
        depth--
        buf += '}}'
        i++
        if (depth === 0 && /\{\{\s*nat fs (?:g )?player/i.test(buf)) {
          const p = parsePlayer(buf, currentTeam)
          if (p) out.push(p)
          buf = ''
        }
        continue
      }
      if (depth > 0) buf += line[i]
    }
    if (depth > 0) buf += '\n'
  }
  return out
}

async function main() {
  const client = postgres(databaseUrl as string, { prepare: false })
  const db = drizzle(client, { schema: { teams, players } })

  console.info('Fetching Wikipedia wikitext for 2026 squads...')
  const res = await fetch(WIKI_URL)
  if (!res.ok) throw new Error(`wikipedia fetch failed: ${res.status}`)
  const json = (await res.json()) as { parse: { wikitext: { '*': string } } }
  const wikitext = json.parse.wikitext['*']
  console.info(`Wikitext: ${wikitext.length} chars.`)

  const parsed = parseAllPlayers(wikitext)
  console.info(`Parsed ${parsed.length} player rows from templates.`)

  const dbTeams = await db.select().from(teams)
  const teamByMatchKey = new Map(dbTeams.map((t) => [teamMatchKey(t.name), t]))
  console.info(`Loaded ${dbTeams.length} teams from DB.`)

  // Resolve each parsed player's team to a DB team_id.
  const unmatchedTeams = new Set<string>()
  const rows: {
    fullName: string
    teamId: string
    position: string | null
    dateOfBirth: string | null
    externalId: string
  }[] = []
  const seen = new Set<string>()
  for (const p of parsed) {
    const t = teamByMatchKey.get(teamMatchKey(p.team))
    if (!t) {
      unmatchedTeams.add(p.team)
      continue
    }
    // Dedupe within a team (some squad lists repeat).
    const dedupeKey = `${t.id}|${p.name.toLowerCase()}|${p.dateOfBirth ?? ''}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    rows.push({
      fullName: p.name,
      teamId: t.id,
      position: p.position,
      dateOfBirth: p.dateOfBirth,
      externalId: `wiki:${t.fifaCode ?? t.id}:${p.name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${p.dateOfBirth ?? 'nodob'}`,
    })
  }

  console.info(`Resolved ${rows.length} players. Unmatched teams: ${unmatchedTeams.size}`)
  if (unmatchedTeams.size > 0) {
    console.info('Unmatched team headings (Wikipedia label → no DB team):')
    for (const u of unmatchedTeams) console.info(`  - ${u}`)
  }

  await db.execute(sql`TRUNCATE TABLE players RESTART IDENTITY CASCADE`)

  // Insert in chunks.
  const CHUNK = 100
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    await db.insert(players).values(chunk).onConflictDoNothing()
    inserted += chunk.length
  }

  const [{ count }] = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int AS count FROM players`,
  )
  console.info(`Done. Inserted ${inserted} (DB now has ${count}).`)
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
