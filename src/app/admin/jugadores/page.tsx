import { asc, desc, eq } from 'drizzle-orm'
import { AdminPlayersClient } from '@/components/admin/admin-players-client'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { players, teams } from '@/db/schema'

export const dynamic = 'force-dynamic'

export default async function AdminPlayersPage() {
  const [playerRows, teamRows] = await Promise.all([
    db
      .select({
        id: players.id,
        externalId: players.externalId,
        fullName: players.fullName,
        teamId: players.teamId,
        goals: players.goals,
        assists: players.assists,
        lastSyncedAt: players.lastSyncedAt,
        teamName: teams.name,
        teamFlag: teams.flagEmoji,
      })
      .from(players)
      .leftJoin(teams, eq(players.teamId, teams.id))
      .orderBy(desc(players.goals), desc(players.assists), asc(players.fullName)),
    db
      .select({ id: teams.id, name: teams.name, flagEmoji: teams.flagEmoji })
      .from(teams)
      .orderBy(asc(teams.name)),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Jugadores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Goles vienen automáticos del cron (worldcup26.ir). Asistencias se editan a mano — la
          fuente actual no las expone.
        </p>
      </div>

      <Card className="border-warning/30 bg-warning/5 p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Cómo funciona</p>
        <ul className="mt-2 space-y-1 list-disc pl-4">
          <li>
            Los jugadores aparecen acá automáticamente cuando meten un gol (vienen del cron diario).
          </li>
          <li>
            <span className="font-medium text-foreground">Goles</span> — editables, pero se
            sobreescriben en el próximo sync del cron si la fuente cambió. Solo editar para corregir
            o agregar jugadores manuales.
          </li>
          <li>
            <span className="font-medium text-foreground">Asistencias</span> — solo manuales. El
            cron NO las toca. Tu valor persiste para siempre.
          </li>
          <li>
            Para sumar a un jugador que no metió goles pero dio asistencias, usa "Agregar jugador".
          </li>
        </ul>
      </Card>

      <AdminPlayersClient players={playerRows} teams={teamRows} />
    </div>
  )
}
