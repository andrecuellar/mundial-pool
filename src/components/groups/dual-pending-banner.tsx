import { AlertTriangle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export type DualPendingGroup = {
  slug: string
  name: string
  daysUntilLock: number
}

type Props = {
  groups: DualPendingGroup[]
  className?: string
}

// Shown above the group list when the user has BOTH no predictions AND no
// pool deposit in some group with lock <= 3 days. Combines the two pending
// actions into one urgent CTA so the user doesn't have to scroll the chips
// and figure it out — the goal is to get them into /groups/{slug} fast,
// where the per-action CTAs (predict + pay) take over.
export function DualPendingBanner({ groups, className }: Props) {
  if (groups.length === 0) return null
  const isSingle = groups.length === 1
  const first = groups[0]

  return (
    <div
      className={`mp-glow-border rounded-xl border-2 border-destructive/50 bg-destructive/5 p-4 ${className ?? ''}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold leading-tight">
              {isSingle
                ? `Atención: te falta todo en "${first.name}"`
                : `Atención: te falta todo en ${groups.length} grupos`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {isSingle ? (
                <>
                  Cierra{' '}
                  <span className="font-medium text-foreground">
                    {first.daysUntilLock === 0
                      ? 'hoy'
                      : first.daysUntilLock === 1
                        ? 'mañana'
                        : `en ${first.daysUntilLock} días`}
                  </span>
                  {' '}y todavía no completaste tus predicciones ni aportaste al pozo.
                </>
              ) : (
                <>
                  En estos grupos no has hecho predicciones ni aportado al pozo, y todos cierran en
                  los próximos días:{' '}
                  <span className="font-medium text-foreground">
                    {groups.map((g) => g.name).join(', ')}
                  </span>
                  .
                </>
              )}
            </p>
          </div>
          {isSingle && (
            <Link
              href={`/groups/${first.slug}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
            >
              Ir a {first.name}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
