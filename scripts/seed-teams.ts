import { config } from 'dotenv'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { teams } from '../src/db/schema'

config({ path: '.env.local' })
config({ path: '.env' })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const SOURCE_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.teams.json'

type OpenFootballTeam = {
  name: string
  name_normalised?: string
  continent: string
  flag_icon: string
  fifa_code: string
  group: string
  confed: string
}

async function main() {
  const client = postgres(databaseUrl as string, { prepare: false })
  const db = drizzle(client, { schema: { teams } })

  console.info('Fetching WC 2026 team list from openfootball...')
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`openfootball request failed: ${res.status}`)
  const list = (await res.json()) as OpenFootballTeam[]
  console.info(`Got ${list.length} teams.`)

  await db.execute(sql`TRUNCATE TABLE teams RESTART IDENTITY CASCADE`)

  for (const t of list) {
    await db
      .insert(teams)
      .values({
        externalId: t.fifa_code,
        fifaCode: t.fifa_code,
        name: t.name_normalised ?? t.name,
        flagEmoji: t.flag_icon,
      })
      .onConflictDoUpdate({
        target: teams.externalId,
        set: {
          fifaCode: t.fifa_code,
          name: t.name_normalised ?? t.name,
          flagEmoji: t.flag_icon,
        },
      })
  }

  const [{ count }] = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int AS count FROM teams`,
  )
  console.info(`Done. Total teams in db: ${count}`)
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
