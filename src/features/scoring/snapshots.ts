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
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export async function recomputeAllLeaderboardSnapshots(): Promise<void> {
  const all = await db.select({ id: groups.id }).from(groups)
  for (const g of all) {
    // Reintentos CON DELAY: tras la resolución pesada, la primera query del
    // batch cae sobre un pool "sucio" (conexiones churneadas) y falla; un
    // reintento inmediato también falla, pero con una pausa breve el pool se
    // recupera y el siguiente intento pasa. El fallback en carga de página no
    // sufre esto porque corre sobre conexiones frescas.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await recomputeLeaderboardSnapshot(g.id)
        break
      } catch (e) {
        console.error(`recomputeLeaderboardSnapshot ${g.id} intento ${attempt}/3 falló`, e)
        if (attempt < 3) await sleep(500 * attempt)
      }
    }
  }
}
