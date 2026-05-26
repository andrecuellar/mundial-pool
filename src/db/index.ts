import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

// Use Supabase's transaction pooler (port 6543). Each Vercel function
// invocation gets its own Node process, so a max of 1 connection avoids
// exhausting the pool when many requests hit at once. prepare: false is
// required because PgBouncer transaction mode cannot keep prepared
// statements across transactions.
const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
})

export const db = drizzle(client, { schema })

export type Db = typeof db
