import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

// Supabase transaction pooler (port 6543), prepare:false requerido (transaction
// mode no preserva prepared statements).
//
// Config anti-conexiones-zombi. El problema: bajo Fluid Compute la instancia se
// CONGELA entre requests; los sockets del pool mueren (los cierra Supavisor/NAT)
// pero postgres.js los cree vivos. Al despertar, la query se escribe a un socket
// muerto → la DB la ejecuta y queda en `ClientRead` esperando un cliente que ya
// no existe → conexión huérfana que NO se libera. Suficientes huérfanas agotan
// el pool de Supavisor y TODO request se cuelga (espiral de muerte observada).
//
// Defensa: idle_timeout corto (5s) cierra las conexiones ociosas durante la
// ventana en que la instancia sigue "caliente", ANTES de que Fluid la congele —
// así no quedan sockets abiertos que puedan volverse zombis. max_lifetime acota
// la edad total. max:10 basta (la carga real por request bajó con el cacheo) y
// reduce cuántas conexiones pueden quedar huérfanas de golpe.
const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 10,
  idle_timeout: 5,
  max_lifetime: 60 * 5,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })

export type Db = typeof db
