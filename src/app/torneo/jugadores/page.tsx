import { desc, eq, isNotNull } from 'drizzle-orm'
import { Clock, Goal, HandHeart, RefreshCw } from 'lucide-react'
import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { PlayerLeaderboardTable } from '@/components/share/player-leaderboard-table'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { db } from '@/db'
import { players, teams } from '@/db/schema'
import { formatDayShort } from '@/lib/format'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Goleadores y asistentes',
  description: 'Cómo se decide la Bota de Oro y el Máximo Asistente del Mundial 2026.',
}

type PlayerRow = {
  id: string
  fullName: string
  position: string | null
  goals: number
  assists: number
  minutesPlayed: number
  lastSyncedAt: Date | null
  teamName: string | null
  teamFlag: string | null
}

// Mismo patrón que /torneo/selecciones: snapshot global cacheado por tag,
// invalidado por el cron /api/cron/player-stats (revalidateTag('players')).
// El TTL es safety fallback si el cron deja de correr.
const getPlayerLeaderboard = unstable_cache(
  async (): Promise<PlayerRow[]> => {
    const rows = await db
      .select({
        id: players.id,
        fullName: players.fullName,
        position: players.position,
        goals: players.goals,
        assists: players.assists,
        minutesPlayed: players.minutesPlayed,
        lastSyncedAt: players.lastSyncedAt,
        teamName: teams.name,
        teamFlag: teams.flagEmoji,
      })
      .from(players)
      .leftJoin(teams, eq(players.teamId, teams.id))
      .where(isNotNull(players.lastSyncedAt))
      .orderBy(desc(players.goals), desc(players.assists))
    return rows
  },
  ['players-leaderboard-v1'],
  { revalidate: 3600, tags: ['players'] },
)

function formatRelative(when: Date): string {
  const diffMs = Date.now() - when.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'hace menos de 1 min'
  if (min < 60) return `hace ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `hace ${hr} ${hr === 1 ? 'hora' : 'horas'}`
  const days = Math.floor(hr / 24)
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`
}

export default async function TableJugadoresPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const playerRows = await getPlayerLeaderboard()

  // Listas completas; la tabla muestra el top 20 con opción de expandir.
  const scorers = playerRows
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.minutesPlayed - b.minutesPlayed)

  const assistants = playerRows
    .filter((p) => p.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals || a.minutesPlayed - b.minutesPlayed)

  // unstable_cache serializa su retorno a JSON: en un cache hit los Date vuelven
  // como strings ISO, no como objetos Date. Reconstruimos un Date real aquí —
  // si no, formatRelative(when) llama when.getTime() sobre un string y revienta
  // el render del server (digest → global-error). new Date(...) acepta tanto el
  // Date del cache miss como el string del cache hit.
  const lastSyncedAt = playerRows.reduce<Date | null>((acc, p) => {
    if (!p.lastSyncedAt) return acc
    const when = new Date(p.lastSyncedAt)
    if (!acc || when > acc) return when
    return acc
  }, null)

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Player'
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null
  const today = formatDayShort(new Date())

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[{ label: 'Jugadores' }]}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <BackLink href="/" label="Inicio" className="mb-4" />

        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Tabla de jugadores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Goleadores y asistentes del Mundial 2026 según las estadísticas oficiales de FIFA.
        </p>

        {lastSyncedAt && (
          <Card className="mt-3 border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed">
            <div className="flex flex-wrap items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground">
                <span className="font-medium">Última actualización:</span>{' '}
                {formatRelative(lastSyncedAt)}
              </span>
            </div>
          </Card>
        )}

        <Card className="mt-5 border-warning/30 bg-warning/5 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">¿Qué cuenta y qué no cuenta?</p>
          <ul className="mt-2 space-y-1.5">
            <li>
              <span className="font-medium text-foreground">
                Goles en los 90 min reglamentarios
              </span>
              : cuentan.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Goles en la prórroga (30 min extra)
              </span>
              : cuentan también — son parte del partido.
            </li>
            <li>
              <span className="font-medium text-foreground">Goles en la tanda de penales</span>:{' '}
              <span className="text-destructive font-medium">no cuentan</span>. La tanda de penales
              es solo un desempate, no parte del partido.
            </li>
            <li>
              <span className="font-medium text-foreground">Asistencias</span>: igual criterio —
              cuentan las del partido (regulación + prórroga), no las de la tanda de penales.
            </li>
            <li>
              <span className="font-medium text-foreground">Autogoles</span>: cuentan para el equipo
              que los recibió, no para el jugador que los hizo.
            </li>
          </ul>
        </Card>

        <Tabs defaultValue="goals" className="mt-6">
          <TabsList>
            <TabsTrigger value="goals">
              <Goal className="h-3.5 w-3.5" />
              Goleadores
            </TabsTrigger>
            <TabsTrigger value="assists">
              <HandHeart className="h-3.5 w-3.5" />
              Asistencias
            </TabsTrigger>
          </TabsList>

          <TabsContent value="goals">
            {scorers.length === 0 ? (
              <EmptyTable
                title="Aún no hay goleadores"
                description="La tabla se llena con cada partido del Mundial. La Bota de Oro la decide FIFA al cierre del torneo: total de goles → asistencias → menos minutos jugados → fair play."
              />
            ) : (
              <PlayerLeaderboardTable
                rows={scorers}
                metric="goals"
                id="tabla-goleadores-card"
                label="Goleadores"
                subtitle={`Mundial 2026 · ${today}`}
                fileName="mundial-pool-goleadores"
                shareTitle="Goleadores · Mundial 2026"
                shareText="Tabla de goleadores del Mundial 2026 ⚽ en mundial-pool"
              />
            )}
          </TabsContent>

          <TabsContent value="assists">
            {assistants.length === 0 ? (
              <EmptyTable
                title="Aún no hay asistencias"
                description="La tabla se llena con cada partido del Mundial. El Máximo Asistente se decide según las estadísticas oficiales de FIFA al cierre del torneo: total de asistencias → menos minutos jugados → fair play."
              />
            ) : (
              <PlayerLeaderboardTable
                rows={assistants}
                metric="assists"
                id="tabla-asistentes-card"
                label="Asistencias"
                subtitle={`Mundial 2026 · ${today}`}
                fileName="mundial-pool-asistentes"
                shareTitle="Asistencias · Mundial 2026"
                shareText="Tabla de asistentes del Mundial 2026 🅰️ en mundial-pool"
              />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}

function EmptyTable({ title, description }: { title: string; description: string }) {
  return (
    <Card className="mt-3 p-8 sm:p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-dashed border-border bg-muted">
        <Clock className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </Card>
  )
}
