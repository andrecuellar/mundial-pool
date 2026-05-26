import { config } from 'dotenv'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { teams } from '../src/db/schema'

config({ path: '.env.local' })
config({ path: '.env' })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const ES_NAMES: Record<string, string> = {
  ALG: 'Argelia',
  ARG: 'Argentina',
  AUS: 'Australia',
  AUT: 'Austria',
  BEL: 'Bélgica',
  BIH: 'Bosnia y Herzegovina',
  BRA: 'Brasil',
  CAN: 'Canadá',
  CIV: 'Costa de Marfil',
  COD: 'RD Congo',
  COL: 'Colombia',
  CPV: 'Cabo Verde',
  CRO: 'Croacia',
  CUW: 'Curazao',
  CZE: 'República Checa',
  ECU: 'Ecuador',
  EGY: 'Egipto',
  ENG: 'Inglaterra',
  ESP: 'España',
  FRA: 'Francia',
  GER: 'Alemania',
  GHA: 'Ghana',
  HAI: 'Haití',
  IRN: 'Irán',
  IRQ: 'Irak',
  JOR: 'Jordania',
  JPN: 'Japón',
  KOR: 'Corea del Sur',
  KSA: 'Arabia Saudita',
  MAR: 'Marruecos',
  MEX: 'México',
  NED: 'Países Bajos',
  NOR: 'Noruega',
  NZL: 'Nueva Zelanda',
  PAN: 'Panamá',
  PAR: 'Paraguay',
  POR: 'Portugal',
  QAT: 'Catar',
  RSA: 'Sudáfrica',
  SCO: 'Escocia',
  SEN: 'Senegal',
  SUI: 'Suiza',
  SWE: 'Suecia',
  TUN: 'Túnez',
  TUR: 'Turquía',
  URU: 'Uruguay',
  USA: 'Estados Unidos',
  UZB: 'Uzbekistán',
}

async function main() {
  const client = postgres(databaseUrl as string, { prepare: false })
  const db = drizzle(client, { schema: { teams } })

  const rows = await db.select().from(teams)
  let updated = 0
  const missing: string[] = []
  for (const t of rows) {
    if (!t.fifaCode) continue
    const es = ES_NAMES[t.fifaCode]
    if (!es) {
      missing.push(`${t.fifaCode} (${t.name})`)
      continue
    }
    if (t.name === es) continue
    await db.update(teams).set({ name: es }).where(eq(teams.id, t.id))
    updated++
  }
  const [{ count }] = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int AS count FROM teams`,
  )
  console.info(`Updated ${updated} team names. Total teams: ${count}.`)
  if (missing.length > 0) {
    console.info(`Missing Spanish names for: ${missing.join(', ')}`)
  }
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
