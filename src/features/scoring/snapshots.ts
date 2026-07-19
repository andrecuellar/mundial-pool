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
      console.error('recomputeLeaderboardSnapshot failed for group', g.id, e)
    }
  }
}
