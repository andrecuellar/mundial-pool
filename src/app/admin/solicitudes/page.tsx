import { desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import Link from 'next/link'
import { AdminDataTable } from '@/components/admin/data-table'
import { GroupRequestActions } from '@/components/admin/group-request-actions'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { db } from '@/db'
import { groupCreationRequests, profiles } from '@/db/schema'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Solicitudes',
  description: 'Aprobar o rechazar pedidos de permiso para crear grupos.',
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

export default async function AdminSolicitudesPage() {
  const requester = alias(profiles, 'requester')
  const reviewer = alias(profiles, 'reviewer')

  const [pending, recent] = await Promise.all([
    db
      .select({
        id: groupCreationRequests.id,
        message: groupCreationRequests.message,
        createdAt: groupCreationRequests.createdAt,
        userId: groupCreationRequests.userId,
        displayName: requester.displayName,
        email: requester.email,
      })
      .from(groupCreationRequests)
      .innerJoin(requester, eq(requester.id, groupCreationRequests.userId))
      .where(eq(groupCreationRequests.status, 'pending'))
      .orderBy(groupCreationRequests.createdAt),
    db
      .select({
        id: groupCreationRequests.id,
        message: groupCreationRequests.message,
        status: groupCreationRequests.status,
        reviewedAt: groupCreationRequests.reviewedAt,
        rejectionReason: groupCreationRequests.rejectionReason,
        userId: groupCreationRequests.userId,
        displayName: requester.displayName,
        email: requester.email,
        reviewerName: reviewer.displayName,
      })
      .from(groupCreationRequests)
      .innerJoin(requester, eq(requester.id, groupCreationRequests.userId))
      .leftJoin(reviewer, eq(reviewer.id, groupCreationRequests.reviewedByUserId))
      .where(eq(groupCreationRequests.status, 'approved'))
      .orderBy(desc(groupCreationRequests.reviewedAt))
      .limit(50),
  ])

  // Pull rejected too, in a third query so we can show approved+rejected
  // together in "decididas". Cheaper than UNION in drizzle.
  const rejected = await db
    .select({
      id: groupCreationRequests.id,
      message: groupCreationRequests.message,
      status: groupCreationRequests.status,
      reviewedAt: groupCreationRequests.reviewedAt,
      rejectionReason: groupCreationRequests.rejectionReason,
      userId: groupCreationRequests.userId,
      displayName: requester.displayName,
      email: requester.email,
      reviewerName: reviewer.displayName,
    })
    .from(groupCreationRequests)
    .innerJoin(requester, eq(requester.id, groupCreationRequests.userId))
    .leftJoin(reviewer, eq(reviewer.id, groupCreationRequests.reviewedByUserId))
    .where(eq(groupCreationRequests.status, 'rejected'))
    .orderBy(desc(groupCreationRequests.reviewedAt))
    .limit(50)

  const decided = [...recent, ...rejected]
    .sort((a, b) => (b.reviewedAt?.getTime() ?? 0) - (a.reviewedAt?.getTime() ?? 0))
    .slice(0, 50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Solicitudes de crear grupos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando un usuario pide permiso para crear grupos, aparece aquí. Una vez aprobado, puede
          crear todos los grupos que quiera sin volver a pedir.
        </p>
      </div>

      <AdminDataTable
        title={`Pendientes · ${pending.length}`}
        empty={pending.length === 0}
        emptyText="No hay solicitudes pendientes."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="hidden sm:table-cell">Mensaje</TableHead>
              <TableHead className="hidden md:table-cell">Pedida</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/admin/usuarios/${r.userId}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {r.displayName}
                  </Link>
                  {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
                </TableCell>
                <TableCell className="hidden sm:table-cell max-w-[20rem] text-sm text-muted-foreground">
                  {r.message ?? <span className="italic">(sin mensaje)</span>}
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                  {formatRelative(r.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <GroupRequestActions requestId={r.id} displayName={r.displayName} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminDataTable>

      <AdminDataTable
        title={`Decididas · últimas ${decided.length}`}
        empty={decided.length === 0}
        emptyText="Aún no se decidió ninguna."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden sm:table-cell">Revisó</TableHead>
              <TableHead className="hidden md:table-cell">Motivo</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Hace</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {decided.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/admin/usuarios/${r.userId}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {r.displayName}
                  </Link>
                  {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
                </TableCell>
                <TableCell>
                  {r.status === 'approved' ? (
                    <Badge
                      variant="secondary"
                      className="border-accent/30 bg-accent/10 text-accent"
                    >
                      Aprobada
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="border-destructive/30 bg-destructive/10 text-destructive"
                    >
                      Rechazada
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                  {r.reviewerName ?? '—'}
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[16rem]">
                  {r.rejectionReason ??
                    (r.status === 'rejected' ? <span className="italic">(sin motivo)</span> : '—')}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground text-right">
                  {r.reviewedAt ? formatRelative(r.reviewedAt) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminDataTable>
    </div>
  )
}
