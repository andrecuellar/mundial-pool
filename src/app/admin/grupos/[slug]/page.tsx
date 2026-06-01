import { notFound } from 'next/navigation'
import { BackLink } from '@/components/app-shell/back-link'
import { AdminDataTable } from '@/components/admin/data-table'
import { AllPredictionsView } from '@/components/predictions/all-predictions-view'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAdminGroupDetail } from '@/features/admin/queries'
import { getAllGroupPredictions } from '@/features/predictions/queries'
import { formatDayTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export default async function AdminGroupDetailPage({ params }: Params) {
  const { slug } = await params
  const detail = await getAdminGroupDetail(slug)
  if (!detail) notFound()

  // Reuse the public matrix view so admins see the exact same shape members
  // would after lock.
  const predictionsView = await getAllGroupPredictions(detail.group.id)

  return (
    <div className="space-y-6">
      <BackLink href="/admin/grupos" label="Grupos" />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{detail.group.name}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          slug: {detail.group.slug} · invite code: {detail.group.inviteCode}
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Miembros
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{detail.members.length}</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Cierra
          </p>
          <p className="mt-1 text-sm font-medium">{formatDayTime(detail.group.predictionsLockAt)}</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Pozo
          </p>
          <p className="mt-1 text-sm font-medium">
            {detail.group.poolEnabled
              ? `${detail.transactions.length} tx · ${detail.group.poolCurrency ?? '—'}`
              : 'Desactivado'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Payout rule
          </p>
          <p className="mt-1 text-sm font-medium">{detail.group.poolPayoutRule}</p>
        </Card>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Miembros</TabsTrigger>
          <TabsTrigger value="predictions">Predicciones</TabsTrigger>
          <TabsTrigger value="pool">Pozo</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <AdminDataTable empty={detail.members.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.members.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell className="font-medium">{m.displayName}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {m.email ?? '—'}
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
        </TabsContent>

        <TabsContent value="predictions">
          {predictionsView.members.length === 0 ? (
            <AdminDataTable empty emptyText="Aún no hay miembros con predicciones." />
          ) : (
            <AllPredictionsView view={predictionsView} currentUserId="" />
          )}
        </TabsContent>

        <TabsContent value="pool">
          {detail.group.poolEnabled ? (
            <div className="space-y-4">
              {detail.group.poolQrUrl && (
                <Card className="p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    QR de depósito
                  </p>
                  {/* biome-ignore lint/performance/noImgElement: external QR */}
                  <img
                    src={detail.group.poolQrUrl}
                    alt="QR del pozo"
                    className="mt-3 w-full max-w-xs rounded-lg border border-border"
                  />
                </Card>
              )}
              <AdminDataTable
                title={`Transacciones (${detail.transactions.length})`}
                empty={detail.transactions.length === 0}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contribuyente</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="hidden sm:table-cell">Nota</TableHead>
                      <TableHead className="hidden sm:table-cell">Registró</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm">{t.contributorLabel}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {t.amount.toFixed(2)} {t.currency}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {t.note ?? '—'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">
                          {t.registeredByName ?? '—'}
                        </TableCell>
                        <TableCell className="hidden text-right font-mono text-xs text-muted-foreground md:table-cell">
                          {formatDayTime(t.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AdminDataTable>
            </div>
          ) : (
            <AdminDataTable empty emptyText="El pozo está desactivado en este grupo." />
          )}
        </TabsContent>

        <TabsContent value="categories">
          <AdminDataTable empty={detail.categories.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Puntos</TableHead>
                  <TableHead className="text-right">Default</TableHead>
                  <TableHead className="text-right">Enabled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.categories.map((c) => (
                  <TableRow key={c.key}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.valueKind}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{c.points}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {c.defaultPoints}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.enabled ? (
                        <Badge className="border-accent/30 bg-accent/15 text-accent text-[10px]">
                          Sí
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          No
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminDataTable>
        </TabsContent>
      </Tabs>
    </div>
  )
}
