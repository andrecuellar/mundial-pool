import { config } from 'dotenv'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { teams } from '../src/db/schema'

config({ path: '.env.local' })
config({ path: '.env' })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

// FIFA Men's World Ranking — June 11, 2026 snapshot (último publicado antes
// del arranque del Mundial 2026).
// Source for top 50: official FIFA release on inside.fifa.com + cross-checked
// against the football-ranking.com live tracker.
// Source for the 11 sub-50 teams below: per-team web lookups against the
// same June 11, 2026 publication.
const RANKING: Record<string, number> = {
  ARG: 1,
  ESP: 2,
  FRA: 3,
  ENG: 4,
  POR: 5,
  BRA: 6,
  MAR: 7,
  NED: 8,
  BEL: 9,
  GER: 10,
  CRO: 11,
  // 12. Italy — did not qualify
  COL: 13,
  MEX: 14,
  SEN: 15,
  URU: 16,
  USA: 17,
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
  CIV: 33,
  PAN: 34,
  // 35. Russia — banned
  // 36. Poland — did not qualify
  // 37. Wales — did not qualify
  SWE: 38,
  CZE: 39,
  PAR: 40,
  // 41. Hungary — did not qualify
  SCO: 42,
  // 43. Serbia — did not qualify
  // 44. Cameroon — did not qualify
  COD: 45,
  TUN: 46,
  // 47. Slovakia — did not qualify
  // 48. Greece — did not qualify
  // 49. Venezuela — did not qualify
  UZB: 50,

  // Sub-50 qualifiers (positions 51+).
  IRQ: 56,
  QAT: 57,
  RSA: 60,
  KSA: 61,
  JOR: 63,
  BIH: 64,
  CPV: 67,
  GHA: 73,
  CUW: 82,
  HAI: 83,
  NZL: 85,
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
