import { Lock } from 'lucide-react'
import Link from 'next/link'
import { AdminDataTable } from '@/components/admin/data-table'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listAdminGroups } from '@/features/admin/queries'
import { formatDayTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AdminGroupsPage() {
  const rows = await listAdminGroups()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Grupos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos los grupos del sistema. Click en uno para ver miembros, predicciones, pozo y QR.
        </p>
      </div>

      <AdminDataTable title={`${rows.length} grupos`} empty={rows.length === 0}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden sm:table-cell">Creador</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Miembros</TableHead>
              <TableHead className="hidden text-right md:table-cell">Completos</TableHead>
              <TableHead className="hidden text-right md:table-cell">Pozo</TableHead>
              <TableHead className="hidden text-right xl:table-cell">Cierre</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((g) => {
              const locked = new Date() >= g.predictionsLockAt
              return (
                <TableRow key={g.id}>
                  <TableCell>
                    <Link href={`/admin/grupos/${g.slug}`} className="font-medium hover:underline">
                      {g.name}
                    </Link>
                    <div className="font-mono text-[10px] text-muted-foreground">{g.slug}</div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{g.ownerName}</TableCell>
                  <TableCell>
                    {locked ? (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="h-3 w-3" />
                        Bloqueado
                      </Badge>
                    ) : (
                      <Badge className="gap-1 border-accent/30 bg-accent/15 text-accent">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        Abierto
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {g.memberCount}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono tabular-nums md:table-cell">
                    <span
                      className={
                        g.completedMembers === g.memberCount && g.memberCount > 0
                          ? 'text-accent'
                          : ''
                      }
                    >
                      {g.completedMembers}/{g.memberCount}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right font-mono tabular-nums md:table-cell">
                    {g.poolEnabled ? (
                      <span>
                        {g.poolTotal.toFixed(2)}{' '}
                        <span className="text-[10px] text-muted-foreground">{g.poolCurrency}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono text-xs text-muted-foreground xl:table-cell">
                    {formatDayTime(g.predictionsLockAt)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </AdminDataTable>
    </div>
  )
}
