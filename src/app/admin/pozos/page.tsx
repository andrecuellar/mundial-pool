import Link from 'next/link'
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
import { listAdminPoolTransactions, listAdminQrUploads } from '@/features/admin/queries'
import { formatDayTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AdminPoolsPage() {
  const [transactions, qrUploads] = await Promise.all([
    listAdminPoolTransactions(),
    listAdminQrUploads(),
  ])

  const totalsByCurrency = new Map<string, number>()
  for (const t of transactions) {
    totalsByCurrency.set(t.currency, (totalsByCurrency.get(t.currency) ?? 0) + t.amount)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pozos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas las transacciones cross-group, totales por moneda y QR subidos.
        </p>
      </div>

      {totalsByCurrency.size > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from(totalsByCurrency.entries()).map(([currency, total]) => (
            <Card key={currency} className="p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Total {currency}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{total.toFixed(2)}</p>
            </Card>
          ))}
        </div>
      )}

      <AdminDataTable
        title={`Transacciones (${transactions.length})`}
        empty={transactions.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead>Contribuyente</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="hidden sm:table-cell">Nota</TableHead>
              <TableHead className="hidden sm:table-cell">Registró</TableHead>
              <TableHead className="hidden text-right md:table-cell">Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link
                    href={`/admin/grupos/${t.groupSlug}`}
                    className="font-medium hover:underline"
                  >
                    {t.groupName}
                  </Link>
                </TableCell>
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

      <div>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          QR subidos ({qrUploads.length})
        </h2>
        {qrUploads.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">
            Aún no se ha subido ningún QR.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {qrUploads.map((q) => (
              <Card key={q.slug} className="overflow-hidden p-0">
                <div className="border-b border-border bg-muted/20 px-3 py-2 text-xs">
                  <Link
                    href={`/admin/grupos/${q.slug}`}
                    className="font-medium hover:underline"
                  >
                    {q.name}
                  </Link>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                    {q.currency ?? '—'}
                  </span>
                </div>
                {q.qrUrl && (
                  // biome-ignore lint/performance/noImgElement: external QR
                  <img
                    src={q.qrUrl}
                    alt={`QR de ${q.name}`}
                    className="aspect-square w-full object-contain bg-card"
                  />
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
