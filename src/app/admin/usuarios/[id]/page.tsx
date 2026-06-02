import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BanUserButton } from '@/components/admin/ban-user-button'
import { AdminDataTable } from '@/components/admin/data-table'
import { BackLink } from '@/components/app-shell/back-link'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAuthUser } from '@/features/admin/auth-queries'
import { getAdminUserDetail } from '@/features/admin/queries'
import { isSuperAdminEmail } from '@/lib/admin'
import { formatDayTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export default async function AdminUserDetailPage({ params }: Params) {
  const { id } = await params
  const [detail, auth] = await Promise.all([getAdminUserDetail(id), getAuthUser(id)])
  if (!detail.profile) notFound()
  const p = detail.profile

  return (
    <div className="space-y-6">
      <BackLink href="/admin/usuarios" label="Usuarios" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{p.displayName}</h1>
            {p.bannedAt && (
              <Badge
                variant="secondary"
                className="border-destructive/40 bg-destructive/10 text-destructive"
              >
                Baneado
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {auth?.email ?? p.email ?? 'Sin email'}{' '}
            {auth?.provider && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {auth.provider}
              </Badge>
            )}
          </p>
        </div>
        {!isSuperAdminEmail(p.email ?? auth?.email ?? null) && (
          <BanUserButton userId={p.id} displayName={p.displayName} isBanned={p.bannedAt !== null} />
        )}
      </div>

      {p.bannedAt && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-destructive">
            Estado del baneo
          </p>
          <p className="mt-1 text-sm">
            Baneado el <span className="font-mono">{formatDayTime(p.bannedAt)}</span>
          </p>
          {p.bannedReason && (
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Motivo:</span> {p.bannedReason}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Creado
          </p>
          <p className="mt-1 text-sm font-medium">{formatDayTime(p.createdAt)}</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Último login
          </p>
          <p className="mt-1 text-sm font-medium">
            {auth?.lastSignInAt ? formatDayTime(auth.lastSignInAt) : '—'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Grupos
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{detail.memberships.length}</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Predicciones
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{detail.predictions.length}</p>
        </Card>
      </div>

      <AdminDataTable
        title={`Membresías (${detail.memberships.length})`}
        empty={detail.memberships.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-right">Se unió</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.memberships.map((m) => (
              <TableRow key={m.groupId}>
                <TableCell>
                  <Link
                    href={`/admin/grupos/${m.groupSlug}`}
                    className="font-medium hover:underline"
                  >
                    {m.groupName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[10px]">
                    {m.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {formatDayTime(m.joinedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminDataTable>

      <AdminDataTable
        title={`Predicciones (${detail.predictions.length})`}
        empty={detail.predictions.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Predicción</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Actualizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.predictions.map((pred, i) => (
              <TableRow key={`${pred.groupSlug}-${pred.categoryKey}-${i}`}>
                <TableCell>
                  <Link href={`/admin/grupos/${pred.groupSlug}`} className="hover:underline">
                    {pred.groupName}
                  </Link>
                </TableCell>
                <TableCell className="text-xs">{pred.categoryName}</TableCell>
                <TableCell className="text-sm font-medium">
                  {pred.teamName ?? pred.playerText ?? renderTeamSet(pred.teamSet) ?? '—'}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs text-muted-foreground sm:table-cell">
                  {formatDayTime(pred.updatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminDataTable>

      <AdminDataTable
        title={`Aportes al pozo (${detail.contributedTransactions.length})`}
        empty={detail.contributedTransactions.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="hidden sm:table-cell">Nota</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.contributedTransactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link href={`/admin/grupos/${t.groupSlug}`} className="hover:underline">
                    {t.groupName}
                  </Link>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm">
                  {t.amount.toFixed(2)} {t.currency}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                  {t.note ?? '—'}
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

function renderTeamSet(teamSet: unknown): string | null {
  if (!Array.isArray(teamSet) || teamSet.length === 0) return null
  return teamSet.map((t) => (typeof t === 'string' ? t.slice(0, 8) : '?')).join(', ')
}
