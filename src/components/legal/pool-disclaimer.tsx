import { AlertTriangle } from 'lucide-react'

type Variant = 'home' | 'qr' | 'form' | 'admin'

type Props = {
  variant: Variant
  className?: string
}

// Single source of truth for the pool/betting disclaimers. The copy lives here so
// the legal posture stays consistent across surfaces — changing the wording in
// one place updates every touchpoint.
export function PoolDisclaimer({ variant, className }: Props) {
  if (variant === 'home') {
    return (
      <div
        className={`flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-foreground ${className ?? ''}`}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <p className="font-medium">Esto es un pool entre amigos. No es una casa de apuestas.</p>
          <p className="mt-1 text-muted-foreground">
            La app solo lleva el registro — el dinero lo manejan ustedes fuera de la app y el
            reparto lo hace cada administrador de grupo. Únete solo a grupos de gente que conozcas.
            No nos hacemos responsables por pérdidas, fraudes o disputas entre miembros.
          </p>
        </div>
      </div>
    )
  }

  if (variant === 'qr') {
    return (
      <div
        className={`rounded-xl border-2 border-destructive bg-destructive/10 p-4 text-destructive ${className ?? ''}`}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold uppercase tracking-wide">
            Esto no es una casa de apuestas
          </p>
        </div>
        <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-destructive/90">
          <li className="flex gap-2">
            <span aria-hidden>•</span>
            <span>
              La app <strong>no procesa pagos</strong>. Lo que mandes va directamente al admin del
              grupo.
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden>•</span>
            <span>
              El reparto del dinero al final del torneo lo hace <strong>el admin del grupo</strong>,
              no mundial-pool.
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden>•</span>
            <span>
              Solo aporta si conoces personalmente al admin y confías en él.{' '}
              <strong>No nos hacemos responsables por pérdidas, fraudes ni disputas.</strong>
            </span>
          </li>
        </ul>
      </div>
    )
  }

  if (variant === 'form') {
    return (
      <div
        className={`flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-xs leading-relaxed text-foreground ${className ?? ''}`}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="font-medium text-destructive">Al activar el pozo declaras que:</p>
          <p className="mt-1 text-muted-foreground">
            solo invitarás a personas que conoces, tú resuelves los pagos fuera de la app, y
            entiendes que mundial-pool no es una casa de apuestas ni se hace responsable por
            pérdidas o disputas entre los miembros del grupo.
          </p>
        </div>
      </div>
    )
  }

  // variant === 'admin'
  return (
    <div
      className={`rounded-xl border-2 border-destructive/60 bg-destructive/5 p-4 text-foreground ${className ?? ''}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="space-y-2 text-sm leading-relaxed">
          <p className="font-semibold text-destructive">
            Tu responsabilidad: cobrar y registrar cada aporte.
          </p>
          <p className="text-muted-foreground">
            Tu palabra es lo que sostiene este pozo. Cada vez que recibas un pago (Yape, Tigo Money,
            transferencia, efectivo), revisa tu cuenta y luego regístralo en esta misma página con
            el botón <span className="font-medium text-foreground">"Registrar un pago nuevo"</span>.
            Sin ese registro el jugador queda como pendiente y puede ser eliminado del reparto.
          </p>
          <p className="text-muted-foreground">
            Al final del torneo, tú haces las transferencias por tu cuenta — la app no procesa pagos
            ni reparte premios. Si te equivocas, eliminas el registro y vuelves a empezar. Tu nombre
            y correo de Google se muestran a los miembros al abrir el QR.
          </p>
          <p className="text-muted-foreground">
            mundial-pool no es una casa de apuestas y no se hace responsable por disputas, fraudes o
            pérdidas.
          </p>
        </div>
      </div>
    </div>
  )
}
