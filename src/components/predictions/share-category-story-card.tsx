import { renderPick } from '@/components/predictions/render-pick'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { AllPredictionsPick } from '@/features/predictions/queries'
import type { ReactionBucket } from '@/features/reactions/types'

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '·'
  )
}

export type StoryRow = {
  userId: string
  displayName: string
  avatarUrl: string | null
  pick: AllPredictionsPick | undefined
  reactions: ReactionBucket[]
}

type Props = {
  /** Must match the `targetId` passed to the share button. */
  id: string
  categoryName: string
  groupName: string
  rows: StoryRow[]
}

// Poster off-screen (formato vertical ~9:19) que se captura como imagen al tocar
// "Compartir" en una categoría filtrada. Vive fuera del viewport (position:fixed,
// left:-20000px) y `shareDomNodeAsImage` lo trae temporalmente a z-index:-1 para
// pintarlo antes de la captura. A diferencia del ReactionBar en pantalla —que solo
// muestra emoji + conteo— acá expandimos los nombres de quién reaccionó, que es la
// gracia de compartir la carta.
export function ShareCategoryStoryCard({ id, categoryName, groupName, rows }: Props) {
  return (
    <div
      id={id}
      aria-hidden
      style={{ position: 'fixed', left: '-20000px', top: 0 }}
      className="flex min-h-[1140px] w-[540px] flex-col overflow-hidden bg-card text-foreground"
    >
      <div className="border-b border-border bg-gradient-to-b from-primary/10 to-transparent px-7 pb-6 pt-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          mundial•pool · {groupName}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">{categoryName}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Lo que apostó el grupo · {rows.length} {rows.length === 1 ? 'miembro' : 'miembros'}
        </p>
      </div>

      <ul className="flex-1 divide-y divide-border">
        {rows.map((r) => (
          <li key={r.userId} className="px-7 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-10 w-10">
                  {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt={r.displayName} />}
                  <AvatarFallback className="text-xs">{initials(r.displayName)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-[15px] font-semibold">{r.displayName}</span>
              </div>
              <div className="text-right text-[15px]">{renderPick(r.pick)}</div>
            </div>
            {r.reactions.length > 0 && (
              <div className="mt-2.5 flex flex-col gap-1.5 pl-[52px]">
                {r.reactions.map((b) => (
                  <div key={b.emoji} className="flex items-start gap-2 text-xs leading-snug">
                    <span className="shrink-0 text-base leading-none">{b.emoji}</span>
                    <span className="text-muted-foreground">{b.reactors.join(' · ')}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-auto border-t border-border bg-muted/20 px-7 py-5 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          mundial•pool · Mundial 2026
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">mundial-pool.vercel.app</p>
      </div>
    </div>
  )
}
