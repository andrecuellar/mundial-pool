import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

// Supabase transaction pooler (port 6543) handles connection multiplexing at
// PgBouncer, so connections are cheap. With Vercel Fluid Compute reusing the
// same Lambda for multiple concurrent requests, /groups/[slug] alone runs ~8
// parallel queries; with 3 simultaneous requests in one instance demand peaks
// near 24, so we keep max:15 to absorb the burst before queueing internally.
// Supavisor has 200 slots total — plenty of headroom for other Lambdas.
// prepare:false is required: PgBouncer transaction mode does not preserve
// prepared statements across transactions.
const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 15,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })

export type Db = typeof db
