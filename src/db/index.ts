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
  // Recicla cada conexión a los 5min. Bajo Fluid Compute la instancia se
  // congela entre requests y los sockets ociosos del pool mueren (los cierra
  // Supavisor/NAT) sin que postgres.js lo note; al despertar, la primera query
  // sobre un socket zombi se cuelga hasta el timeout de la función. max_lifetime
  // fuerza el descarte de conexiones viejas antes de que se vuelvan zombis.
  max_lifetime: 60 * 5,
})

export const db = drizzle(client, { schema })

export type Db = typeof db
