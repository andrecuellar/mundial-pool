import { revalidateTag } from 'next/cache'
import { db } from '@/db'
import { players, teams } from '@/db/schema'
import { teamMatchKey } from '@/integrations/football/normalize'
import { fetchPlayerStats } from '@/integrations/football/worldcup26-players'

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
  unmatchedTeams: string[]
}

export async function syncPlayerStats(): Promise<SyncResult> {
  const stats = await fetchPlayerStats()
  const teamLookup = await buildTeamLookup()

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
          // No tocamos assists ni minutesPlayed: la fuente actual no los
          // expone, así que sobreescribir con 0 borraría cualquier override
          // manual que admin haya hecho en el futuro.
          photoUrl: p.photoUrl,
          goals: p.goals,
          lastSyncedAt: now,
        },
      })
    upserted += 1
  }

  // Next 16: el segundo arg matchea el profile aplicado a unstable_cache.
  revalidateTag('players', 'hours')

  return {
    syncedAt: now.toISOString(),
    fetched: stats.length,
    upserted,
    unmatchedTeams: [...unmatched],
  }
}
