import { asc } from 'drizzle-orm'
import { Trophy } from 'lucide-react'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { teams } from '@/db/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const WORLD_CUP_START = new Date('2026-06-11T22:00:00Z')

export default async function TableSeleccionesPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      flagEmoji: teams.flagEmoji,
      fifaCode: teams.fifaCode,
      fifaRanking: teams.fifaRanking,
    })
    .from(teams)
    .orderBy(asc(teams.fifaRanking))

  // Internal Mundial rank: position among the 48 WC teams sorted by global
  // FIFA rank. Stays as a fallback preview until the tournament starts and we
  // can show the real finish position.
  const ranked = rows.map((t, i) => ({ ...t, mundialRank: i + 1 }))
  const tournamentStarted = new Date() >= WORLD_CUP_START

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
              <span className="font-medium">Dentro de los brackets de eliminación directa</span>{' '}
              (cuartos, octavos y 16vos de final) los perdedores se ordenan así:
              <ul className="mt-1.5 ml-4 list-[circle] space-y-1 text-muted-foreground">
                <li>
                  Primero los que perdieron{' '}
                  <span className="font-medium text-foreground">por penales</span> (es decir,
                  empataron en los 90 minutos + la prórroga y recién se definió en la tanda). Entre
                  ellos, los que <span className="font-medium text-foreground">hicieron más goles</span>{' '}
                  en ese partido quedan mejor que los que hicieron menos. Si igual están empatados
                  en goles, gana el de mejor{' '}
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
                        {t.mundialRank === 1 && <Trophy className="h-3 w-3 text-gold" />}
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
