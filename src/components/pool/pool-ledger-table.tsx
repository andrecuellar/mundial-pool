import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PoolTransactionRow } from '@/features/pool/queries'
import { formatMoney } from '@/lib/format'
import { DeleteTransactionButton } from './delete-transaction-button'

type Props = {
  rows: PoolTransactionRow[]
  currency: string
  ownerMode?: boolean
  groupId?: string
}

export function PoolLedgerTable({ rows, currency, ownerMode, groupId }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">Aún no hay depósitos registrados.</p>
      </div>
    )
  }

  const total = rows.reduce((acc, r) => acc + r.amount, 0)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contribuyente</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead className="hidden sm:table-cell">Nota</TableHead>
            <TableHead className="hidden sm:table-cell">Fecha</TableHead>
            {ownerMode && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.contributorLabel}</TableCell>
              <TableCell className="font-mono tabular-nums">
                {formatMoney(r.amount, r.currency)}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground">
                {r.note ?? '—'}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                {r.createdAt.toLocaleDateString('es-BO', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </TableCell>
              {ownerMode && groupId && (
                <TableCell>
                  <DeleteTransactionButton
                    groupId={groupId}
                    transactionId={r.id}
                    label={`${formatMoney(r.amount, r.currency)} de ${r.contributorLabel}`}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <span>
          {rows.length} {rows.length === 1 ? 'depósito' : 'depósitos'}
        </span>
        <span className="font-mono">
          Total:{' '}
          <span className="text-foreground font-semibold">{formatMoney(total, currency)}</span>
        </span>
      </div>
    </div>
  )
}
