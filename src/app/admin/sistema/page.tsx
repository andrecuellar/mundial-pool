import { AdminDataTable } from '@/components/admin/data-table'
import { FinalOddsForm } from '@/components/admin/final-odds-form'
import { ForceResolutionButton } from '@/components/admin/force-resolution-button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listAdminAppState, listAdminResolutionRuns } from '@/features/admin/queries'
import { getWinProbabilities } from '@/features/tournament/win-probabilities'
import { env } from '@/lib/env'
import { formatDayTime } from '@/lib/format'

export const dynamic = 'force-dynamic'
// runResolution puede tardar hasta ~60s (lee predicciones → computa → escribe
// resultados → notifica). Dale al server action el mismo techo que el cron.
export const maxDuration = 60

export default async function AdminSistemaPage() {
  const [runs, state, probs] = await Promise.all([
    listAdminResolutionRuns(),
    listAdminAppState(),
    getWinProbabilities().catch(() => null),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sistema</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estado del sistema, configuración, estado global y auditoría de las tareas programadas.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Proveedor de fútbol
          </p>
          <p className="mt-1 text-sm font-medium">{env.FOOTBALL_API_PROVIDER}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {env.FOOTBALL_API_KEY ? 'Clave de API configurada' : 'Sin clave de API configurada'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Secreto de tareas programadas
          </p>
          <p className="mt-1 text-sm font-medium">
            {env.CRON_SECRET || env.RESOLUTION_CRON_SECRET ? 'Configurado' : 'No configurado'}
          </p>
        </Card>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Resolución manual
          </p>
          <p className="mt-1 text-sm font-medium">Forzar la resolución ahora</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Corre el mismo proceso que el cron, al instante. Idempotente: solo resuelve lo que ya se
            puede resolver. Útil apenas termina un partido (p.ej. la final).
          </p>
        </div>
        <ForceResolutionButton />
      </Card>

      <Card className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Cuotas de la final
        </p>
        <p className="mt-1 mb-3 text-[11px] text-muted-foreground">
          Probabilidad de campeón entre los finalistas (de casas de apuestas). Alimenta el % que se
          muestra en las cards de predicciones y el leaderboard.
        </p>
        <FinalOddsForm finalOdds={probs?.finalOdds ?? []} />
      </Card>

      <AdminDataTable
        title={`Estado global (${state.length})`}
        description="Singletons globales. Útil para revisar el límite del rate-limit del enlace mágico."
        empty={state.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Llave</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="text-right">Actualizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.map((s) => (
              <TableRow key={s.key}>
                <TableCell className="font-mono text-xs">{s.key}</TableCell>
                <TableCell className="font-mono text-xs">{s.value}</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {formatDayTime(s.updatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminDataTable>

      <AdminDataTable
        title={`Ejecuciones de resolución (${runs.length})`}
        description="Últimas 50 ejecuciones de la tarea programada de resolución."
        empty={runs.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Iniciada</TableHead>
              <TableHead>Terminada</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{formatDayTime(r.startedAt)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.finishedAt ? formatDayTime(r.finishedAt) : '—'}
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase ${
                      r.status === 'completed'
                        ? 'bg-accent/15 text-accent'
                        : r.status === 'failed'
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {r.status}
                  </span>
                </TableCell>
                <TableCell>
                  {r.details ? (
                    <details className="max-w-xs">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        Ver JSON
                      </summary>
                      <pre className="mt-1 max-h-64 overflow-auto rounded border border-border bg-muted/30 p-2 text-[10px] leading-tight">
                        {JSON.stringify(r.details, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminDataTable>
    </div>
  )
}
