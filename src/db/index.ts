import { drizzle } from 'drizzle-orm/postgres-js'
import { after } from 'next/server'
import postgres from 'postgres'
import { cache } from 'react'
import { env } from '@/lib/env'
import * as schema from './schema'

// CONEXIÓN POR REQUEST, cerrada al terminar la respuesta.
//
// El bug (confirmado en pg_stat_activity): un pool de postgres.js a nivel de
// módulo SOBREVIVE entre requests. Bajo Fluid Compute la instancia se congela
// entre visitas y esos sockets mueren (los cierra Supavisor/NAT) sin que
// postgres.js lo note. Al despertar, la query se escribe a un socket muerto: la
// DB la ejecuta pero la respuesta nunca vuelve al cliente → queda en `ClientRead`
// para siempre, ocupando un backend real. Cada request que muere abandona sus
// queries así; suficientes huérfanas agotan Supavisor y TODO se cuelga.
//
// La cura: NO reusar conexiones a través del freeze. Cada request abre su propio
// cliente y lo cierra con `after()` cuando la respuesta ya salió — pase lo que
// pase con el render (incluso si una query se abandonó por timeout, `after` igual
// cierra el cliente, así que nunca queda una conexión huérfana). El pooler de
// transacciones (6543) está hecho para esto: muchas conexiones cortas. Desde
// pdx1 (misma región que la DB) abrir una conexión cuesta ~ms.
const CLIENT_OPTS = {
  prepare: false,
  max: 8,
  idle_timeout: 10,
  connect_timeout: 10,
} as const

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

// React cache() = una sola instancia por request (aislada entre requests
// concurrentes del mismo Fluid instance). after() encola el cierre del cliente.
const getRequestDb = cache((): DrizzleDb => {
  const client = postgres(env.DATABASE_URL, CLIENT_OPTS)
  try {
    after(async () => {
      try {
        await client.end({ timeout: 5 })
      } catch {
        // ya cerrado
      }
    })
  } catch (err) {
    // Sin request scope (script CLI): cerramos el cliente recién creado y
    // dejamos que resolveDb caiga al cliente compartido.
    void client.end({ timeout: 1 }).catch(() => {})
    throw err
  }
  return drizzle(client, { schema })
})

// Cliente compartido de larga vida SOLO para contextos sin request (scripts CLI,
// seeds). Ahí no hay freeze de Fluid, así que un pool persistente es correcto.
let sharedDb: DrizzleDb | null = null

function resolveDb(): DrizzleDb {
  try {
    return getRequestDb()
  } catch {
    sharedDb ??= drizzle(postgres(env.DATABASE_URL, CLIENT_OPTS), { schema })
    return sharedDb
  }
}

// Proxy para no tocar los cientos de call sites que hacen `db.query` / `db.select`.
// Cada acceso resuelve el cliente del request actual; los métodos se bindean a su
// instancia real para no romper el `this` interno de drizzle.
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const inst = resolveDb() as unknown as Record<string | symbol, unknown>
    const value = inst[prop]
    return typeof value === 'function' ? value.bind(inst) : value
  },
})

export type Db = DrizzleDb
