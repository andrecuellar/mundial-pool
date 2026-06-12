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
          Goles y asistencias vienen automáticos del cron diario (ESPN). Editá a mano solo para
          corregir o cubrir jugadores que ESPN no detecta.
        </p>
      </div>

      <Card className="border-warning/30 bg-warning/5 p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Cómo funciona</p>
        <ul className="mt-2 space-y-1 list-disc pl-4">
          <li>
            Los jugadores aparecen acá automáticamente cuando ESPN registra que metieron un gol o
            dieron una asistencia.
          </li>
          <li>
            <span className="font-medium text-foreground">Goles y asistencias</span> son editables,
            pero el cron es la fuente de verdad y los sobreescribe en el próximo sync. Usá la
            edición para correcciones puntuales (vas a perderlas al día siguiente si ESPN no
            coincide).
          </li>
          <li>
            <span className="font-medium text-foreground">Origen</span>: "cron" lo agregó ESPN
            automáticamente; "manual" lo agregaste vos desde acá. Solo los "manual" se pueden
            borrar.
          </li>
          <li>
            Si ESPN no detecta un jugador (raro), usá "Agregar jugador" para sumarlo a mano.
          </li>
        </ul>
      </Card>

      <AdminPlayersClient players={playerRows} teams={teamRows} />
    </div>
  )
}
