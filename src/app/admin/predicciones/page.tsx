import Link from 'next/link'
import { AdminDataTable } from '@/components/admin/data-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listAdminPredictions } from '@/features/admin/queries'
import { formatDayTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

type SP = { category?: string; group?: string }

export default async function AdminPredictionsPage({
  searchParams,
}: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const rows = await listAdminPredictions({
    categoryKey: sp.category,
    groupSlug: sp.group,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Predicciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lista plana cross-group (últimas 500 actualizaciones). Usa{' '}
          <code className="font-mono text-xs">?category=top_scorer_player</code> o{' '}
          <code className="font-mono text-xs">?group=&lt;slug&gt;</code> para filtrar.
        </p>
      </div>

      <AdminDataTable
        title={`${rows.length} predicciones`}
        empty={rows.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Pick</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Actualizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/admin/grupos/${r.groupSlug}`}
                    className="font-medium hover:underline"
                  >
                    {r.groupName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/usuarios/${r.userId}`}
                    className="text-sm hover:underline"
                  >
                    {r.userName}
                  </Link>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.categoryName}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {r.teamName ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-base leading-none">{r.teamFlag ?? '🏳️'}</span>
                      {r.teamName}
                    </span>
                  ) : (
                    (r.playerText ??
                      (Array.isArray(r.teamSet) && r.teamSet.length > 0
                        ? `${r.teamSet.length} equipos`
                        : '—'))
                  )}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs text-muted-foreground sm:table-cell">
                  {formatDayTime(r.updatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminDataTable>
    </div>
  )
}
