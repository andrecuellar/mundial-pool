import { config } from 'dotenv'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { teams } from '../src/db/schema'

config({ path: '.env.local' })
config({ path: '.env' })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

// FIFA Men's World Ranking — April 1, 2026 snapshot (ESPN / Wikipedia).
// Next FIFA update: June 9, 2026 (2 days before the World Cup opening match).
// Teams outside the top 50 are not listed; they keep fifa_ranking = NULL and
// the UI shows them as "+50".
const RANKING: Record<string, number> = {
  FRA: 1,
  ESP: 2,
  ARG: 3,
  ENG: 4,
  POR: 5,
  BRA: 6,
  NED: 7,
  MAR: 8,
  BEL: 9,
  GER: 10,
  CRO: 11,
  // 12. Italy — did not qualify
  COL: 13,
  SEN: 14,
  MEX: 15,
  USA: 16,
  URU: 17,
  JPN: 18,
  SUI: 19,
  // 20. Denmark — did not qualify
  IRN: 21,
  TUR: 22,
  ECU: 23,
  AUT: 24,
  KOR: 25,
  // 26. Nigeria — did not qualify
  AUS: 27,
  ALG: 28,
  EGY: 29,
  CAN: 30,
  NOR: 31,
  // 32. Ukraine — did not qualify
  PAN: 33,
  CIV: 34,
  // 35. Poland — did not qualify
  // 36. Russia — banned
  // 37. Wales — did not qualify
  SWE: 38,
  // 39. Serbia — did not qualify
  PAR: 40,
  CZE: 41,
  // 42. Hungary — did not qualify
  SCO: 43,
  TUN: 44,
  // 45. Cameroon — did not qualify
  COD: 46,
  // 47. Greece — did not qualify
  // 48. Slovakia — did not qualify
  // 49. Venezuela — did not qualify
  UZB: 50,
}

async function main() {
  const client = postgres(databaseUrl as string, { prepare: false })
  const db = drizzle(client, { schema: { teams } })

  const rows = await db.select().from(teams)
  let updated = 0
  let cleared = 0
  for (const t of rows) {
    if (!t.fifaCode) continue
    const rank = RANKING[t.fifaCode] ?? null
    if (rank === t.fifaRanking) continue
    await db.update(teams).set({ fifaRanking: rank }).where(eq(teams.id, t.id))
    if (rank) updated++
    else if (t.fifaRanking != null) cleared++
  }
  const inTop50 = rows.filter((t) => t.fifaCode && RANKING[t.fifaCode]).length
  console.info(
    `Updated ${updated} rankings (${inTop50}/${rows.length} teams in top 50). Cleared: ${cleared}.`,
  )
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
