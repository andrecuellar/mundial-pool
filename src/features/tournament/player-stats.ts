import { like } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { db } from '@/db'
import { players, teams } from '@/db/schema'
import { fetchPlayerStats } from '@/integrations/football/espn-players'
import { teamMatchKey } from '@/integrations/football/normalize'

async function buildTeamLookup(): Promise<Map<string, string>> {
  const rows = await db.select({ id: teams.id, name: teams.name }).from(teams)
  const byKey = new Map<string, string>()
  for (const t of rows) byKey.set(teamMatchKey(t.name), t.id)
  return byKey
}

export type SyncResult = {
  syncedAt: string
  fetched: number
  upserted: number
  deletedLegacy: number
  unmatchedTeams: string[]
}

export async function syncPlayerStats(): Promise<SyncResult> {
  const stats = await fetchPlayerStats()
  const teamLookup = await buildTeamLookup()

  // One-time cleanup: provider anterior (worldcup26.ir) creaba jugadores
  // con externalId "wc26ir-*" usando nombres abreviados ("J. Quiñones").
  // ESPN usa nombres completos ("Julián Quiñones") y prefijo "espn-*", así
  // que sin esto quedarían duplicados en la leaderboard. No tocamos los
  // "admin-*" (jugadores agregados manualmente desde /admin/jugadores).
  const legacyDeleted = await db
    .delete(players)
    .where(like(players.externalId, 'wc26ir-%'))
    .returning({ id: players.id })

  const now = new Date()
  const unmatched = new Set<string>()
  let upserted = 0

  for (const p of stats) {
    const teamId = p.teamName ? (teamLookup.get(teamMatchKey(p.teamName)) ?? null) : null
    if (p.teamName && !teamId) unmatched.add(p.teamName)

    await db
      .insert(players)
      .values({
        externalId: p.externalId,
        fullName: p.fullName,
        teamId,
        position: p.position,
        photoUrl: p.photoUrl,
        goals: p.goals,
        assists: p.assists,
        minutesPlayed: p.minutesPlayed,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: players.externalId,
        set: {
          fullName: p.fullName,
          teamId,
          photoUrl: p.photoUrl,
          goals: p.goals,
          // ESPN sí provee asistencias (parseadas del commentary). Las
          // sobrescribimos en cada sync. Si admin necesita corregir, edita
          // desde /admin/jugadores y el override durará hasta el próximo
          // cron — eso es esperado, el cron es la fuente de verdad.
          assists: p.assists,
          lastSyncedAt: now,
        },
      })
    upserted += 1
  }

  // Next 16: el segundo arg matchea el profile aplicado a unstable_cache.
  revalidateTag('players', 'hours')
  // Y forzamos re-render de las páginas que leen players, por si el viewer
  // tiene la tag cacheada con un TTL más largo.
  revalidatePath('/torneo/jugadores')
  revalidatePath('/admin/jugadores')

  return {
    syncedAt: now.toISOString(),
    fetched: stats.length,
    upserted,
    deletedLegacy: legacyDeleted.length,
    unmatchedTeams: [...unmatched],
  }
}
