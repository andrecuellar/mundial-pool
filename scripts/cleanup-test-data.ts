// One-off cleanup: wipe groups + pool transactions + QR storage so we start
// fresh from pre-launch test data. Users (profiles + auth.users) are kept.
//
// Run with: pnpm dlx tsx scripts/cleanup-test-data.ts
//
// Talks to Supabase Storage via the REST API directly (avoids importing the
// supabase-js client which pulls in realtime-js and needs a WebSocket
// constructor that Node 20 doesn't expose by default).
//
// Cascades handled by FK constraints when DELETE FROM groups runs:
//   - group_members      (groups.id, onDelete cascade)
//   - group_categories   (groups.id, onDelete cascade)
//   - predictions        (groups.id, onDelete cascade)
//   - pool_transactions  (groups.id, onDelete cascade)
//   - prediction_reactions cascades via predictions
import { config } from 'dotenv'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

config({ path: '.env.local' })
config({ path: '.env' })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const QR_BUCKET = 'pool-qr'
const STORAGE_BASE = `${supabaseUrl}/storage/v1`
const storageHeaders = {
  Authorization: `Bearer ${supabaseServiceRoleKey}`,
  apikey: supabaseServiceRoleKey,
  'Content-Type': 'application/json',
}

const client = postgres(databaseUrl, { prepare: false })
const db = drizzle(client)

type StorageEntry = { name: string; id: string | null }

async function listFolder(prefix: string): Promise<StorageEntry[]> {
  const res = await fetch(`${STORAGE_BASE}/object/list/${QR_BUCKET}`, {
    method: 'POST',
    headers: storageHeaders,
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`list ${prefix} failed: ${res.status} ${text}`)
  }
  return (await res.json()) as StorageEntry[]
}

async function removeFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const res = await fetch(`${STORAGE_BASE}/object/${QR_BUCKET}`, {
    method: 'DELETE',
    headers: storageHeaders,
    body: JSON.stringify({ prefixes: paths }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`remove failed: ${res.status} ${text}`)
  }
}

async function count(table: string): Promise<number> {
  const [{ n }] = await db.execute<{ n: number }>(
    sql`SELECT COUNT(*)::int AS n FROM ${sql.raw(table)}`,
  )
  return n
}

async function wipeBucket(): Promise<number> {
  // The bucket stores QRs at `{groupId}/qr-{ts}.{ext}`. We walk one level
  // deep per group folder and collect all paths to remove in batches.
  const allPaths: string[] = []
  const stack: string[] = ['']
  while (stack.length > 0) {
    const dir = stack.pop()!
    const entries = await listFolder(dir)
    for (const entry of entries) {
      const path = dir ? `${dir}/${entry.name}` : entry.name
      if (entry.id === null) {
        // Folder (Supabase signals folders with id === null).
        stack.push(path)
      } else {
        allPaths.push(path)
      }
    }
  }
  for (let i = 0; i < allPaths.length; i += 100) {
    await removeFiles(allPaths.slice(i, i + 100))
  }
  return allPaths.length
}

async function main() {
  console.info('--- BEFORE ---')
  const before = {
    profiles: await count('profiles'),
    groups: await count('groups'),
    group_members: await count('group_members'),
    group_categories: await count('group_categories'),
    predictions: await count('predictions'),
    prediction_reactions: await count('prediction_reactions'),
    pool_transactions: await count('pool_transactions'),
  }
  console.table(before)

  console.info('\nWiping pool-qr bucket…')
  const removedFiles = await wipeBucket()
  console.info(`  removed ${removedFiles} file(s)`)

  console.info(
    '\nDeleting groups (cascades to members, categories, predictions, reactions, pool_transactions)…',
  )
  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM prediction_reactions`)
    await tx.execute(sql`DELETE FROM pool_transactions`)
    await tx.execute(sql`DELETE FROM predictions`)
    await tx.execute(sql`DELETE FROM group_categories`)
    await tx.execute(sql`DELETE FROM group_members`)
    await tx.execute(sql`DELETE FROM groups`)
  })

  console.info('\n--- AFTER ---')
  const after = {
    profiles: await count('profiles'),
    groups: await count('groups'),
    group_members: await count('group_members'),
    group_categories: await count('group_categories'),
    predictions: await count('predictions'),
    prediction_reactions: await count('prediction_reactions'),
    pool_transactions: await count('pool_transactions'),
  }
  console.table(after)

  await client.end()
  console.info('\nDone. Profiles preserved.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
