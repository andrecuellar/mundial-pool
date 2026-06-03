import { AlertTriangle, ChevronRight } from 'lucide-react'
import Link from 'next/link'

type PendingGroup = {
  id: string
  name: string
  slug: string
  isOwner: boolean
}

type Props = {
  groups: PendingGroup[]
  className?: string
}

export function PendingPaymentsBanner({ groups, className }: Props) {
  if (groups.length === 0) return null

  const ownerCount = groups.filter((g) => g.isOwner).length
  const memberCount = groups.length - ownerCount

  const headline = (() => {
    if (groups.length === 1) {
      const g = groups[0]
      return g.isOwner
        ? `Aún no registras tu propio aporte en ${g.name}`
        : `Tu aporte está pendiente en ${g.name}`
    }
    if (ownerCount === 0) return `Tienes aportes pendientes en ${memberCount} grupos`
    if (memberCount === 0)
      return `Aún no registras tu propio aporte en ${ownerCount} ${ownerCount === 1 ? 'grupo que administras' : 'grupos que administras'}`
    return `Tienes aportes pendientes en ${groups.length} grupos (incluyendo ${ownerCount} donde eres admin)`
  })()

  const subline =
    memberCount > 0
      ? 'Si no aportas antes del cierre, el administrador puede eliminarte del reparto del premio.'
      : 'Aunque tú administras el pozo, debes aparecer como contribuyente. Registralo desde Configurar pozo.'

  return (
    <div className={`rounded-xl border border-warning/40 bg-warning/5 p-4 ${className ?? ''}`}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{headline}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{subline}</p>
          </div>
          <ul className="space-y-1.5">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  href={g.isOwner ? `/groups/${g.slug}/admin/pool` : `/groups/${g.slug}#pozo`}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-warning/40 hover:bg-warning/5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{g.name}</span>
                    {g.isOwner && (
                      <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        Admin
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-warning">
                    {g.isOwner ? 'Registrar mi aporte' : 'Ver QR y pagar'}
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
