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
import { listAuthUsers } from '@/features/admin/auth-queries'
import { listAdminUsers } from '@/features/admin/queries'
import { formatDayTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const [profiles, authUsers] = await Promise.all([listAdminUsers(), listAuthUsers()])
  const authById = new Map(authUsers.map((u) => [u.id, u]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Usuarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos los perfiles con su info de auth (provider, último login) y participación en grupos.
        </p>
      </div>

      <AdminDataTable title={`${profiles.length} usuarios`} empty={profiles.length === 0}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden sm:table-cell">Correo</TableHead>
              <TableHead className="hidden md:table-cell">Proveedor</TableHead>
              <TableHead className="text-right">Grupos</TableHead>
              <TableHead className="text-right">Predicciones</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Último login</TableHead>
              <TableHead className="hidden text-right xl:table-cell">Creado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => {
              const auth = authById.get(p.id)
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/admin/usuarios/${p.id}`} className="font-medium hover:underline">
                      {p.displayName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {p.bannedAt ? (
                      <Badge
                        variant="secondary"
                        className="border-destructive/40 bg-destructive/10 text-destructive text-[10px]"
                      >
                        Baneado
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Activo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                    {auth?.email ?? p.email ?? '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {auth?.provider ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {auth.provider}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {p.groupCount}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {p.predictionCount}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono text-xs text-muted-foreground lg:table-cell">
                    {auth?.lastSignInAt ? formatDayTime(auth.lastSignInAt) : '—'}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono text-xs text-muted-foreground xl:table-cell">
                    {formatDayTime(p.createdAt)}
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
