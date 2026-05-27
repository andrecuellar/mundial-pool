import { config } from 'dotenv'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

config({ path: '.env.local' })
config({ path: '.env' })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const client = postgres(databaseUrl, { prepare: false })
const db = drizzle(client)

async function main() {
  const result = await db.execute<{ inserted: number }>(sql`
    WITH ins AS (
      INSERT INTO group_categories (group_id, category_id, points, enabled)
      SELECT g.id, c.id, c.default_points, true
      FROM groups g
      CROSS JOIN categories c
      ON CONFLICT (group_id, category_id) DO NOTHING
      RETURNING group_id
    )
    SELECT COUNT(*)::int AS inserted FROM ins
  `)
  console.info(`Backfilled ${result[0]?.inserted ?? 0} group_categories rows`)
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
