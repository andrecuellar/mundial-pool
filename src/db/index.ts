import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

// Supabase transaction pooler (port 6543) handles connection multiplexing at
// PgBouncer, so a small per-function pool is enough. Going below the default
// (10) caused Promise.all-style RSC pages to serialize their queries and stall
// hydration on slow connections; 5 is a safe middle ground for Vercel
// short-lived Lambdas with parallel server-component data loads. prepare:
// false is required: PgBouncer transaction mode does not preserve prepared
// statements across transactions.
const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })

export type Db = typeof db
