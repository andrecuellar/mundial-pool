import { desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
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
import { db } from '@/db'
import { adminBroadcasts, groups, profiles } from '@/db/schema'
import { describeAudience } from '@/features/notifications/audience'
import { NotificarForm } from './notificar-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Notificar',
  description: 'Enviar push notifications a segmentos de usuarios.',
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

export default async function AdminNotificarPage() {
  const sender = alias(profiles, 'sender')

  const [allGroups, recent] = await Promise.all([
    db
      .select({ id: groups.id, name: groups.name, poolEnabled: groups.poolEnabled })
      .from(groups)
      .orderBy(groups.name),
    db
      .select({
        id: adminBroadcasts.id,
        title: adminBroadcasts.title,
        body: adminBroadcasts.body,
        audienceFilter: adminBroadcasts.audienceFilter,
        audienceCount: adminBroadcasts.audienceCount,
        deliveredCount: adminBroadcasts.deliveredCount,
        ignoreOptOut: adminBroadcasts.ignoreOptOut,
        createdAt: adminBroadcasts.createdAt,
        senderName: sender.displayName,
      })
      .from(adminBroadcasts)
      .leftJoin(sender, eq(sender.id, adminBroadcasts.sentByUserId))
      .orderBy(desc(adminBroadcasts.createdAt))
      .limit(20),
  ])

  const groupNamesById = new Map(allGroups.map((g) => [g.id, g.name]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Enviar notificación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envía un push a un segmento de usuarios. Útil para empujar pagos pendientes, anunciar
          algo, o recordar que faltan predicciones. Los usuarios que apagaron este tipo de aviso en
          sus preferencias quedan excluidos a menos que marques "mensaje crítico".
        </p>
      </div>

      <NotificarForm
        groups={allGroups.map((g) => ({ id: g.id, name: g.name, poolEnabled: g.poolEnabled }))}
      />

      <AdminDataTable
        title={`Historial · últimas ${recent.length}`}
        empty={recent.length === 0}
        emptyText="Aún no enviaste ninguna notificación."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuándo</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="hidden sm:table-cell">Audiencia</TableHead>
              <TableHead className="w-[110px] text-right">Entregadas</TableHead>
              <TableHead className="hidden md:table-cell">Por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {formatRelative(r.createdAt)}
                </TableCell>
                <TableCell className="max-w-[20rem]">
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium leading-tight">
                      {r.title}
                      {r.ignoreOptOut && (
                        <Badge
                          variant="secondary"
                          className="ml-2 border-destructive/30 bg-destructive/10 text-destructive"
                        >
                          crítico
                        </Badge>
                      )}
                    </summary>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{r.body}</p>
                  </details>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                  {describeAudience(r.audienceFilter, groupNamesById)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm">
                  {r.deliveredCount}{' '}
                  <span className="text-[10px] text-muted-foreground">/ {r.audienceCount}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                  {r.senderName ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminDataTable>
    </div>
  )
}
