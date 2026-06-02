import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

// Supabase transaction pooler (port 6543) handles connection multiplexing at
// PgBouncer, so connections are cheap. With Vercel Fluid Compute reusing the
// same Lambda for multiple concurrent requests, max:5 starved Promise.all-
// style RSC pages — /groups/[slug] alone runs ~8 parallel queries, and two
// concurrent visits exhausted the pool. Bumping to 10 keeps headroom without
// abusing PgBouncer. prepare:false is required: PgBouncer transaction mode
// does not preserve prepared statements across transactions.
const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })

export type Db = typeof db
