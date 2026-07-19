import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { groups } from '@/db/schema'
import { computeRankedLeaderboard, writeLeaderboardSnapshot } from '@/features/scoring/queries'

// Recalcula y materializa el snapshot del leaderboard de UN grupo. Se llama en
// las mutaciones que solo afectan a ese grupo (p.ej. join de un miembro).
export async function recomputeLeaderboardSnapshot(groupId: string): Promise<void> {
  const rows = await computeRankedLeaderboard(groupId)
  await writeLeaderboardSnapshot(groupId, rows)
}

// Recalcula TODOS los grupos. Se llama tras eventos globales (resolución,
// sync de stats de jugadores, overrides de admin) que cambian el leaderboard de
// todos. Best-effort por grupo: un fallo en uno no frena al resto. Los grupos
// son pocos (app entre amigos), así que iterar en serie está bien.
export async function recomputeAllLeaderboardSnapshots(): Promise<void> {
  const all = await db.select({ id: groups.id }).from(groups)

  // Tras el trabajo pesado de la resolución, el pool por-request queda "sucio":
  // algunas conexiones murieron (Supavisor las cerró) pero siguen en el pool, y
  // la primera tanda de queries del recompute cae sobre ellas y falla de forma
  // determinística en el primer grupo (la query que falla varía: teams, results…
  // = es nivel-conexión, no la query). Unas queries sacrificiales en paralelo
  // fuerzan a postgres.js a detectar y descartar las conexiones muertas ANTES
  // del recompute real. allSettled: los fallos acá son justamente los que
  // absorben las conexiones muertas.
  await Promise.allSettled(Array.from({ length: 20 }, () => db.execute(sql`select 1`)))

  // Pasada 1: recomputa todos, junta los que fallen.
  const retry: string[] = []
  for (const g of all) {
    try {
      await recomputeLeaderboardSnapshot(g.id)
    } catch (e) {
      console.error('recomputeLeaderboardSnapshot (pasada 1) falló', g.id, e)
      retry.push(g.id)
    }
  }

  // Pasada 2: los que fallaron ya corren sobre un pool limpio (la pasada 1
  // terminó de descartar conexiones muertas).
  for (const id of retry) {
    try {
      await recomputeLeaderboardSnapshot(id)
    } catch (e) {
      console.error('recomputeLeaderboardSnapshot (pasada 2) falló', id, e)
    }
  }
}
