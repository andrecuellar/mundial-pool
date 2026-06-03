import { Clock, Lock, Plus, RefreshCw } from 'lucide-react'
import { NavButton } from '@/components/app-shell/nav-button'
import { Button } from '@/components/ui/button'
import { RequestPermissionDialog } from './request-permission-dialog'

type Props = {
  /** Granted by approval, set true for superadmins, or grandfathered from prior creators. */
  canCreate: boolean
  /** Non-null when the user currently has a pending request awaiting review. */
  pendingRequestId: string | null
  /** Set when the user's most recent request was rejected (no pending one). */
  lastRejectedAt: Date | null
  /** Render flavor — the empty-state Card uses a bigger button, the grid uses h-12. */
  variant?: 'primary' | 'grid'
  /** Used by the empty-state to read "Pedir permiso para crear mi primer grupo". */
  isFirstGroup?: boolean
}

// Smart entry point for group creation. Picks one of four UI states based on
// the user's approval status, falling back to the request-permission dialog
// for anyone who hasn't been granted yet.
export function CreateGroupCTA({
  canCreate,
  pendingRequestId,
  lastRejectedAt,
  variant = 'grid',
  isFirstGroup = false,
}: Props) {
  const gridHeight = variant === 'grid' ? 'h-12' : undefined

  if (canCreate) {
    return (
      <NavButton href="/groups/new" className={gridHeight}>
        <Plus className="h-4 w-4" />
        {isFirstGroup ? 'Crear mi primer grupo' : 'Crear grupo'}
      </NavButton>
    )
  }

  if (pendingRequestId) {
    return (
      <Button
        type="button"
        disabled
        className={gridHeight}
        title="El admin todavía no revisó tu solicitud. Te avisaremos por notificación."
      >
        <Clock className="h-4 w-4" />
        Solicitud pendiente
      </Button>
    )
  }

  if (lastRejectedAt) {
    return (
      <RequestPermissionDialog
        variant="retry"
        trigger={
          <Button type="button" className={gridHeight}>
            <RefreshCw className="h-4 w-4" />
            Volver a pedir permiso
          </Button>
        }
      />
    )
  }

  return (
    <RequestPermissionDialog
      variant="first"
      trigger={
        <Button type="button" className={gridHeight}>
          <Lock className="h-4 w-4" />
          {isFirstGroup
            ? 'Pedir permiso para crear mi primer grupo'
            : 'Pedir permiso para crear un grupo'}
        </Button>
      }
    />
  )
}
