import type * as React from 'react'
import { Card } from '@/components/ui/card'

type Props = {
  children?: React.ReactNode
  title?: string
  description?: string
  empty?: boolean
  emptyText?: string
}

/**
 * Lightweight Card-wrapped data table for the admin panel. Use raw shadcn
 * <Table> primitives inside as children.
 */
export function AdminDataTable({
  children,
  title,
  description,
  empty = false,
  emptyText = 'Sin datos.',
}: Props) {
  return (
    <Card className="overflow-hidden p-0">
      {(title || description) && (
        <div className="border-b border-border bg-muted/20 px-5 py-3">
          {title && (
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {title}
            </p>
          )}
          {description && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
      )}
      {empty ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">{emptyText}</div>
      ) : (
        children
      )}
    </Card>
  )
}
