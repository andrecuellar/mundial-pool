import { Clock, Goal, HandHeart } from 'lucide-react'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function TableJugadoresPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Player'
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[{ label: 'Jugadores' }]}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <BackLink href="/" label="Inicio" className="mb-4" />

        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Tabla de jugadores
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Goleadores y asistentes del Mundial 2026 según las estadísticas oficiales de FIFA.
        </p>

        <Card className="mt-5 border-warning/30 bg-warning/5 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">¿Qué cuenta y qué no cuenta?</p>
          <ul className="mt-2 space-y-1.5">
            <li>
              <span className="font-medium text-foreground">Goles en los 90 min reglamentarios</span>:
              cuentan.
            </li>
            <li>
              <span className="font-medium text-foreground">Goles en la prórroga (30 min extra)</span>:
              cuentan también — son parte del partido.
            </li>
            <li>
              <span className="font-medium text-foreground">Goles en la tanda de penales</span>:{' '}
              <span className="text-destructive font-medium">no cuentan</span>. La tanda de
              penales es solo un desempate, no parte del partido.
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
            <EmptyTable
              title="Aún no hay goleadores"
              description="La tabla se llena con cada partido del Mundial. La Bota de Oro la decide FIFA al cierre del torneo: total de goles → asistencias → menos minutos jugados → fair play."
            />
          </TabsContent>

          <TabsContent value="assists">
            <EmptyTable
              title="Aún no hay asistencias"
              description="La tabla se llena con cada partido del Mundial. El Máximo Asistente se decide según las estadísticas oficiales de FIFA al cierre del torneo: total de asistencias → menos minutos jugados → fair play."
            />
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
