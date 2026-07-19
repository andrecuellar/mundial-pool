import 'server-only'

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
  for (const g of all) {
    try {
      await recomputeLeaderboardSnapshot(g.id)
    } catch (e) {
      // Reintento único: los fallos casi siempre son blips transitorios de
      // conexión (postgres.js en serverless) durante el batch largo. postgres.js
      // descarta la conexión mala, así que el segundo intento agarra una fresca.
      console.error('recomputeLeaderboardSnapshot failed, reintentando', g.id, e)
      try {
        await recomputeLeaderboardSnapshot(g.id)
      } catch (e2) {
        console.error('recomputeLeaderboardSnapshot falló de nuevo para', g.id, e2)
      }
    }
  }
}
