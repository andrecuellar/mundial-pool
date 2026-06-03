import { Vote, Wallet } from 'lucide-react'

type Props = {
  predictionsCompleted: number
  totalPredictions: number
  locked: boolean
  poolEnabled: boolean
  hasPaid: boolean
}

// Inline status chips on the home group cards — shows what's still pending
// from the user's side for this specific group. Both chips use the same
// warning-tinted look as the "Pendiente" badge in the leaderboard so the
// visual language is consistent across the app.
export function GroupCardChips({
  predictionsCompleted,
  totalPredictions,
  locked,
  poolEnabled,
  hasPaid,
}: Props) {
  const missingPredictions = !locked && predictionsCompleted < totalPredictions
  const missingPayment = poolEnabled && !hasPaid
  if (!missingPredictions && !missingPayment) return null

  const remaining = totalPredictions - predictionsCompleted

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {missingPredictions && (
        <span className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
          <Vote className="h-3 w-3" />
          Te faltan {remaining} {remaining === 1 ? 'predicción' : 'predicciones'}
        </span>
      )}
      {missingPayment && (
        <span className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
          <Wallet className="h-3 w-3" />
          Aporte pendiente
        </span>
      )}
    </div>
  )
}
