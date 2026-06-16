import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RequestPermissionDialog } from './request-permission-dialog'

type Props = {
  /** The admin's rejection reason, if any was written. */
  reason: string | null
  /** When the latest request was rejected. Null hides the banner entirely. */
  rejectedAt: Date | null
  className?: string
}

// Big red banner shown on the home page when the user's MOST RECENT
// group-creation request was rejected. The rejection reason normally only
// travels via a push notification (easy to miss), so this surfaces it front
// and center — the goal is that the user reads *why* they were rejected before
// re-requesting. Not dismissible: it stays until they send a new request (which
// flips the status to 'pending' and removes the banner on the next render).
export function GroupRequestRejectedBanner({ reason, rejectedAt, className }: Props) {
  if (!rejectedAt) return null

  return (
    <div
      className={`mp-glow-border rounded-xl border-2 border-destructive/50 bg-destructive/5 p-4 ${className ?? ''}`}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold leading-tight">
              Tu solicitud para crear grupos fue rechazada
            </p>
            {reason ? (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  El admin te rechazó con este motivo:
                </p>
                <p className="rounded-md border border-destructive/30 bg-background/60 px-3 py-2 text-sm font-medium text-foreground leading-relaxed">
                  {reason}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Si vuelves a pedir permiso, responde esto en tu mensaje.
                </p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Vuelve a pedir permiso con más información sobre quién eres y por qué quieres crear
                grupos.
              </p>
            )}
          </div>
          <RequestPermissionDialog
            variant="retry"
            previousReason={reason}
            trigger={
              <Button type="button" variant="destructive" size="sm">
                Volver a pedir permiso
              </Button>
            }
          />
        </div>
      </div>
    </div>
  )
}
