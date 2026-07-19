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

// Recalcula TODOS los grupos tras eventos globales (resolución, sync de stats,
// overrides de admin). Best-effort por grupo: un fallo en uno no frena al resto.
// Un grupo que quede sin recomputar (p.ej. presión de conexiones al final de una
// invocación larga) se backfillea solo en el primer load vía el fallback
// perezoso de getRankedLeaderboard, así que ningún usuario ve algo desactualizado
// más allá de esa primera carga. Los grupos son pocos → iterar en serie va bien.
export async function recomputeAllLeaderboardSnapshots(): Promise<void> {
  const all = await db.select({ id: groups.id }).from(groups)
  for (const g of all) {
    try {
      await recomputeLeaderboardSnapshot(g.id)
    } catch (e) {
      console.error('recomputeLeaderboardSnapshot falló para', g.id, e)
    }
  }
}
