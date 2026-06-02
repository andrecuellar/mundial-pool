// One-off: identify QR files in the pool-qr bucket that no group references
// anymore (huérfanos dejados por el bug de uploadPoolQr antes del fix), then
// delete them. Reports before/after.
//
// Run with: pnpm dlx tsx scripts/cleanup-orphan-qrs.ts
import { config } from 'dotenv'
import { isNotNull, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { groups } from '../src/db/schema'

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
const headers = {
  Authorization: `Bearer ${supabaseServiceRoleKey}`,
  apikey: supabaseServiceRoleKey,
  'Content-Type': 'application/json',
}

const client = postgres(databaseUrl, { prepare: false })
const db = drizzle(client, { schema: { groups } })

type StorageEntry = { name: string; id: string | null }

async function listFolder(prefix: string): Promise<StorageEntry[]> {
  const res = await fetch(`${STORAGE_BASE}/object/list/${QR_BUCKET}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  })
  if (!res.ok) throw new Error(`list ${prefix}: ${res.status} ${await res.text()}`)
  return (await res.json()) as StorageEntry[]
}

async function removeFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const res = await fetch(`${STORAGE_BASE}/object/${QR_BUCKET}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ prefixes: paths }),
  })
  if (!res.ok) throw new Error(`remove: ${res.status} ${await res.text()}`)
}

async function listAllFiles(): Promise<string[]> {
  const all: string[] = []
  const stack: string[] = ['']
  while (stack.length > 0) {
    const dir = stack.pop()!
    const entries = await listFolder(dir)
    for (const e of entries) {
      const p = dir ? `${dir}/${e.name}` : e.name
      if (e.id === null) stack.push(p)
      else all.push(p)
    }
  }
  return all
}

async function main() {
  const allFiles = await listAllFiles()
  console.info(`Bucket contiene ${allFiles.length} archivos.`)

  const dbRows = await db
    .select({ poolQrUrl: groups.poolQrUrl })
    .from(groups)
    .where(isNotNull(groups.poolQrUrl))
  // The URL pattern is .../pool-qr/{path}?... — we extract the path after
  // /pool-qr/ to compare with the storage list.
  const referenced = new Set<string>()
  for (const r of dbRows) {
    if (!r.poolQrUrl) continue
    const m = r.poolQrUrl.match(/\/pool-qr\/(.+?)(?:\?|$)/)
    if (m) referenced.add(decodeURIComponent(m[1]))
  }
  console.info(`Groups referencian ${referenced.size} URL(s) de QR.`)

  const orphans = allFiles.filter((p) => !referenced.has(p))
  console.info(`Huérfanos detectados: ${orphans.length}`)
  if (orphans.length > 0) {
    console.info('Eliminando:')
    for (const o of orphans) console.info(`  - ${o}`)
    for (let i = 0; i < orphans.length; i += 100) {
      await removeFiles(orphans.slice(i, i + 100))
    }
  }

  const finalFiles = await listAllFiles()
  console.info(`\nBucket ahora contiene ${finalFiles.length} archivo(s).`)
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

// Cleanup of the SQL select wrapper — drizzle requires us to import sql even
// if we don't use it directly, suppress the lint via a noop ref.
void sql
