import { Layers, Users, Vote, Wallet } from 'lucide-react'
import Link from 'next/link'
import { AdminDataTable } from '@/components/admin/data-table'
import { KpiTile } from '@/components/admin/kpi-tile'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAdminDashboardSummary } from '@/features/admin/queries'
import { formatDayTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const summary = await getAdminDashboardSummary()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vista global del sistema. Cada KPI lleva al detalle.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Usuarios" value={summary.counts.users} icon={Users} />
        <KpiTile label="Grupos" value={summary.counts.groups} icon={Layers} tone="accent" />
        <KpiTile
          label="Predicciones"
          value={summary.counts.predictions}
          icon={Vote}
          tone="warning"
        />
        <KpiTile label="Transacciones" value={summary.counts.transactions} icon={Wallet} />
      </div>

      {summary.poolTotals.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Pozos acumulados
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {summary.poolTotals.map((p) => (
              <KpiTile
                key={p.currency}
                label={p.currency}
                value={p.total.toFixed(2)}
                sub="Suma de transacciones registradas"
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Última resolución del cron
        </p>
        {summary.lastResolution ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">
                {formatDayTime(summary.lastResolution.startedAt)}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  summary.lastResolution.status === 'completed'
                    ? 'bg-accent/15 text-accent'
                    : summary.lastResolution.status === 'failed'
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {summary.lastResolution.status}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
            El cron de resolución aún no ha corrido.
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminDataTable
          title={`Últimos signups (${summary.recentSignups.length})`}
          empty={summary.recentSignups.length === 0}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="text-right">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.recentSignups.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/usuarios/${u.id}`} className="hover:underline">
                      {u.displayName}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                    {u.email ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {formatDayTime(u.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminDataTable>

        <AdminDataTable
          title={`Últimos grupos (${summary.recentGroups.length})`}
          empty={summary.recentGroups.length === 0}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">Creado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.recentGroups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/grupos/${g.slug}`} className="hover:underline">
                      {g.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {formatDayTime(g.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminDataTable>
      </div>

      <AdminDataTable
        title={`Últimas transacciones (${summary.recentTransactions.length})`}
        empty={summary.recentTransactions.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead>Contribuyente</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.recentTransactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link href={`/admin/grupos/${t.groupSlug}`} className="font-medium hover:underline">
                    {t.groupName}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{t.contributorLabel}</TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {t.amount.toFixed(2)} {t.currency}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs text-muted-foreground sm:table-cell">
                  {formatDayTime(t.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminDataTable>
    </div>
  )
}
