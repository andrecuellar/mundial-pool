import { AdminDataTable } from '@/components/admin/data-table'
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
import { env } from '@/lib/env'
import { formatDayTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AdminSistemaPage() {
  const [runs, state] = await Promise.all([listAdminResolutionRuns(), listAdminAppState()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sistema</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estado del sistema, configuración, app_state global y auditoría del cron.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Football provider
          </p>
          <p className="mt-1 text-sm font-medium">{env.FOOTBALL_API_PROVIDER}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {env.FOOTBALL_API_KEY ? 'API key configurada' : 'Sin API key configurada'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Cron secret
          </p>
          <p className="mt-1 text-sm font-medium">
            {env.CRON_SECRET || env.RESOLUTION_CRON_SECRET ? 'Configurado' : 'No configurado'}
          </p>
        </Card>
      </div>

      <AdminDataTable
        title={`App state (${state.length})`}
        description="Singletons globales. Útil para revisar el deadline del rate-limit del magic link."
        empty={state.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="text-right">Updated</TableHead>
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
        title={`Resolution runs (${runs.length})`}
        description="Últimas 50 ejecuciones del cron de resolución."
        empty={runs.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Finished</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  {formatDayTime(r.startedAt)}
                </TableCell>
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
