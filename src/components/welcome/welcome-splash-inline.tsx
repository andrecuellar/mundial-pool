import type { BoringMatchView } from '@/features/welcome/boring-matches'
import { MatchCard } from './match-card'

type Props = {
  matches: BoringMatchView[]
  className?: string
}

// Versión inline (no overlay, no auto-dismiss) que vive en la columna
// derecha del login. Sin localStorage gate, sin dismiss: las cards entran
// con stagger y después flotan con drift infinito.
export function WelcomeSplashInline({ matches, className }: Props) {
  return (
    <div className={`space-y-2.5 ${className ?? ''}`}>
      {matches.map((m, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: lista estática
          key={i}
          className="mp-card-fly-in"
          style={{ animationDelay: `${i * 120}ms` }}
        >
          <div
            className="mp-card-drift"
            style={{ animationDelay: `${600 + i * 120}ms` }}
          >
            <MatchCard {...m} />
          </div>
        </div>
      ))}
    </div>
  )
}
