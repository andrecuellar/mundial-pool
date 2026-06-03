import { asc, desc, eq } from 'drizzle-orm'
import { RefreshCw, Trophy } from 'lucide-react'
import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { resolutionRuns, teams } from '@/db/schema'
import {
  computeTournamentRanks,
  type TournamentTeamInput,
} from '@/features/scoring/tournament-rank'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { CRON_HOUR_UTC, WORLD_CUP_START } from '@/lib/world-cup'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Las 48 selecciones',
  description:
    'Ranking 1→48 con desempates por penales, fair play y diferencia de gol del Mundial 2026.',
}

type Reached = TournamentTeamInput['reached']

// Same teams for every viewer; tournament state mutates via the daily cron
// which calls revalidateTag('teams'). Cache TTL is a safety fallback if the
// cron silently stops.
const getTeamsForBoard = unstable_cache(
  async () =>
    db
      .select({
        id: teams.id,
        name: teams.name,
        flagEmoji: teams.flagEmoji,
        fifaCode: teams.fifaCode,
        fifaRanking: teams.fifaRanking,
        reachedRound: teams.reachedRound,
        groupPoints: teams.groupPoints,
        groupGoalDiff: teams.groupGoalDiff,
        groupGoalsFor: teams.groupGoalsFor,
        yellowCards: teams.yellowCards,
        redCards: teams.redCards,
        elimMatchGoalsFor: teams.elimMatchGoalsFor,
        elimMatchGoalsAgainst: teams.elimMatchGoalsAgainst,
        elimMatchWentToPenalties: teams.elimMatchWentToPenalties,
      })
      .from(teams)
      .orderBy(asc(teams.fifaRanking)),
  ['teams-board-v2'],
  { revalidate: 3600, tags: ['teams'] },
)

function reachedLabel(r: string | null, started: boolean): string {
  if (!started || r === null) return started ? 'Activo' : '—'
  switch (r) {
    case 'champion':
      return 'Campeón'
    case 'runner_up':
      return 'Subcampeón'
    case 'third':
      return '3er lugar'
    case 'fourth':
      return '4to lugar'
    case 'qf':
      return 'Cuartos'
    case 'r16':
      return 'Octavos'
    case 'r32':
      return '16vos'
    case 'group':
      return 'Fase de grupos'
    default:
      return '—'
  }
}

function nextCronAt(): Date {
  const next = new Date()
  next.setUTCHours(CRON_HOUR_UTC, 0, 0, 0)
  if (next.getTime() <= Date.now()) {
    next.setUTCDate(next.getUTCDate() + 1)
  }
  return next
}

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

function formatInBolivia(when: Date): string {
  return new Intl.DateTimeFormat('es-BO', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/La_Paz',
    hour12: false,
  }).format(when)
}

export default async function TableSeleccionesPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tournamentStarted = new Date() >= WORLD_CUP_START
  const [rowsRaw, lastRunRow] = await Promise.all([
    getTeamsForBoard(),
    tournamentStarted
      ? db
          .select({ finishedAt: resolutionRuns.finishedAt })
          .from(resolutionRuns)
          .where(eq(resolutionRuns.status, 'completed'))
          .orderBy(desc(resolutionRuns.finishedAt))
          .limit(1)
      : Promise.resolve([] as { finishedAt: Date | null }[]),
  ])

  // Normalize global FIFA ranking to 1-48 across only the 48 World Cup teams.
  // The algorithm expects this normalized rank, not the raw global value.
  const sortedByFifa = [...rowsRaw].sort(
    (a, b) => (a.fifaRanking ?? 999) - (b.fifaRanking ?? 999),
  )
  const normalizedFifaRank = new Map<string, number>()
  sortedByFifa.forEach((t, i) => normalizedFifaRank.set(t.id, i + 1))

  const algoInput: TournamentTeamInput[] = rowsRaw.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    fifaRank: normalizedFifaRank.get(t.id) ?? 48,
    reached: (t.reachedRound ?? 'group') as Reached,
    groupPoints: t.groupPoints,
    groupGoalDiff: t.groupGoalDiff,
    groupGoalsFor: t.groupGoalsFor,
    yellowCards: t.yellowCards,
    redCards: t.redCards,
    eliminationMatch:
      t.elimMatchGoalsFor != null
        ? {
            wentToPenalties: t.elimMatchWentToPenalties,
            goalsFor: t.elimMatchGoalsFor,
            goalsAgainst: t.elimMatchGoalsAgainst ?? 0,
          }
        : undefined,
  }))

  const algoRanks = computeTournamentRanks(algoInput)
  const teamById = new Map(rowsRaw.map((t) => [t.id, t]))
  const ranked = algoRanks.map((r) => {
    const t = teamById.get(r.teamId)
    return {
      ...(t as (typeof rowsRaw)[number]),
      mundialRank: r.tournamentRank,
    }
  })

  const lastFinishedAt = lastRunRow[0]?.finishedAt ?? null
  const nextRun = nextCronAt()

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Player'
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[{ label: 'Selecciones' }]}
      />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <BackLink href="/" label="Inicio" className="mb-4" />

        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Tabla de las 48 selecciones
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ranking general del Mundial 2026 (1 = mejor del torneo, 48 = última).
        </p>

        {tournamentStarted && (
          <Card className="mt-3 border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed">
            <div className="flex flex-wrap items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground">
                <span className="font-medium">Última actualización:</span>{' '}
                {lastFinishedAt ? formatRelative(lastFinishedAt) : 'pendiente'}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                Próxima: <span className="font-medium text-foreground">{formatInBolivia(nextRun)}</span>{' '}
                (hora de Bolivia)
              </span>
            </div>
            <p className="mt-1.5 text-muted-foreground">
              La tabla se actualiza automáticamente cuando termina el cron. Si un equipo todavía
              está en carrera, aparece como{' '}
              <span className="font-medium text-foreground">Activo</span> y se reposiciona
              recién cuando se decide su eliminación.
            </p>
          </Card>
        )}

        <Card className="mt-5 p-5 text-sm leading-relaxed space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Cómo se ordena
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-foreground">
            <li>
              <span className="font-medium">Etapa alcanzada</span>: campeón → subcampeón → tercero →
              cuarto → perdedores de cuartos → perdedores de octavos → perdedores de dieciseisavos →
              eliminados en grupos.
            </li>
            <li>
              <span className="font-medium">Dentro de las fases de eliminación directa</span>{' '}
              (cuartos, octavos y 16vos de final) los perdedores se ordenan así:
              <ul className="mt-1.5 ml-4 list-[circle] space-y-1 text-muted-foreground">
                <li>
                  Primero los que perdieron{' '}
                  <span className="font-medium text-foreground">por penales</span> (es decir,
                  empataron en los 90 minutos + la prórroga y recién se definió en la tanda). Entre
                  ellos, los que{' '}
                  <span className="font-medium text-foreground">hicieron más goles</span> en ese
                  partido quedan mejor que los que hicieron menos. Si igual están empatados en
                  goles, gana el de mejor{' '}
                  <span className="font-medium text-foreground">fair play</span> (menos tarjetas
                  amarillas + rojas en el torneo).
                </li>
                <li>
                  Después los que perdieron por derrota en tiempo regular o prórroga. Mejor
                  diferencia de gol del partido → más goles a favor → fair play.
                </li>
              </ul>
            </li>
            <li>
              <span className="font-medium">Fase de grupos</span> (eliminados antes de los 16vos):
              puntos del grupo → diferencia de gol → goles a favor → fair play (criterio FIFA
              estándar).
            </li>
          </ol>
        </Card>

        <Card className="mt-3 border-warning/30 bg-warning/5 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">¿Cuentan los goles de la prórroga?</p>
          <p className="mt-1">
            <span className="font-medium text-foreground">Sí.</span> Los goles de los 90 minutos
            reglamentarios y de los 30 minutos de tiempo extra suman para diferencia de gol y goles
            a favor (regla FIFA estándar).{' '}
            <span className="font-medium text-foreground">
              Los goles de la tanda de penales NO cuentan
            </span>{' '}
            — la tanda de penales es solo un mecanismo de desempate y el marcador oficial del
            partido queda como empate.
          </p>
        </Card>

        {!tournamentStarted && (
          <Card className="mt-3 border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">
                El Mundial empieza el 11 de junio.
              </span>{' '}
              Hasta entonces la columna <span className="font-mono">Mundial</span> muestra el
              ranking FIFA pre-Mundial entre las 48 selecciones (qué tan favorito es cada equipo).
              Una vez termine el torneo, esta columna pasa a mostrar la posición final.
            </p>
          </Card>
        )}

        <Card className="mt-5 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">
                    {tournamentStarted ? 'Mundial' : 'M (pre)'}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Selección</th>
                  {tournamentStarted && (
                    <th className="hidden px-3 py-2 text-left font-medium md:table-cell">
                      Etapa
                    </th>
                  )}
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                    FIFA global
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((t, i) => (
                  <tr key={t.id} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/15'}>
                    <td className="px-3 py-2 align-middle">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums">
                        {t.mundialRank === 1 && tournamentStarted && (
                          <Trophy className="h-3 w-3 text-gold" />
                        )}
                        {t.mundialRank}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-base leading-none">{t.flagEmoji ?? '🏳️'}</span>
                        <span className="font-medium">{t.name}</span>
                        {t.fifaCode && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {t.fifaCode}
                          </span>
                        )}
                      </span>
                    </td>
                    {tournamentStarted && (
                      <td className="hidden px-3 py-2 align-middle text-xs text-muted-foreground md:table-cell">
                        {reachedLabel(t.reachedRound, tournamentStarted)}
                      </td>
                    )}
                    <td className="hidden px-3 py-2 align-middle text-right font-mono text-xs text-muted-foreground tabular-nums sm:table-cell">
                      #{t.fifaRanking ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </>
  )
}
