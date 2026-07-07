import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { RankedLeaderboardRow } from '@/features/scoring/queries'
import { competitionRanks } from '@/features/scoring/rank'

// Poster off-screen en formato story vertical (540×≥1140 ≈ 9:19, entre 9:16 y
// 9:21) que se captura como imagen desde el botón "Compartir para historias"
// de la tabla de líderes. El espacio es reducido, así que cada fila condensa:
// puesto, nombre, puntos, ✓aciertos / ✗fallos definitivos y las banderas de
// las selecciones elegidas que ya quedaron eliminadas, con un 🚫 superpuesto.
// Solo entran los primeros MAX_ROWS puestos (+ la fila propia si queda fuera).

const MAX_ROWS = 12
const MAX_FLAGS = 6

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

// Bandera con el 🚫 encima. Apilado con grid (ambos en la misma celda) en vez
// de position:absolute — html-to-image lo rasteriza de forma más fiable.
function DeadFlag({ flag }: { flag: string }) {
  return (
    <span className="relative inline-grid h-5 w-5 place-items-center align-middle">
      <span className="col-start-1 row-start-1 text-[13px] leading-none opacity-60">{flag}</span>
      <span className="col-start-1 row-start-1 text-[17px] leading-none">🚫</span>
    </span>
  )
}

function rankLabel(rank: number, tied: boolean, hasScores: boolean): string {
  if (hasScores && !tied) {
    if (rank === 1) return '🏆'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
  }
  return `${rank}`
}

type StoryEntry = { row: RankedLeaderboardRow; rank: number; tied: boolean }

function StoryRow({
  entry,
  isMe,
  hasScores,
}: {
  entry: StoryEntry
  isMe: boolean
  hasScores: boolean
}) {
  const { row, rank, tied } = entry
  const extraFlags = row.deadFlags.length - MAX_FLAGS
  return (
    <li className={`px-6 py-3 ${isMe ? 'bg-primary/10' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="grid w-9 shrink-0 place-items-center font-mono text-lg font-semibold tabular-nums">
          {rankLabel(rank, tied, hasScores)}
        </span>
        <Avatar className="h-9 w-9 shrink-0">
          {row.avatarUrl && <AvatarImage src={row.avatarUrl} alt={row.displayName} />}
          <AvatarFallback className="text-xs">{initials(row.displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">{row.displayName}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
            <span className="text-success">✓{row.correctCount}</span>
            <span className="text-destructive/80">✗{row.failedCount}</span>
            {row.deadFlags.length > 0 && (
              <span className="inline-flex items-center gap-0.5">
                {row.deadFlags.slice(0, MAX_FLAGS).map((f) => (
                  <DeadFlag key={f} flag={f} />
                ))}
                {extraFlags > 0 && <span className="text-[10px]">+{extraFlags}</span>}
              </span>
            )}
          </p>
        </div>
        <span className="shrink-0 text-right font-mono text-xl font-bold tabular-nums">
          {row.totalPoints}
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">pts</span>
        </span>
      </div>
    </li>
  )
}

type Props = {
  /** Must match the `targetId` passed to the share button. */
  id: string
  groupName: string
  rows: RankedLeaderboardRow[]
  currentUserId: string
  dateLabel: string
}

export function ShareLeaderboardStoryCard({
  id,
  groupName,
  rows,
  currentUserId,
  dateLabel,
}: Props) {
  const hasScores = rows.some((r) => r.totalPoints > 0)
  const ranks = competitionRanks(rows)
  const entries: StoryEntry[] = rows.map((row, i) => ({
    row,
    rank: ranks[i].rank,
    tied: ranks[i].tied,
  }))

  const top = entries.slice(0, MAX_ROWS)
  const mine = entries.find((e) => e.row.userId === currentUserId)
  const mineOutsideTop = mine && !top.includes(mine) ? mine : null
  const hiddenCount = rows.length - top.length - (mineOutsideTop ? 1 : 0)

  return (
    <div
      id={id}
      aria-hidden
      style={{ position: 'fixed', left: '-20000px', top: 0 }}
      className="flex min-h-[1140px] w-[540px] flex-col overflow-hidden bg-card text-foreground"
    >
      <div className="border-b border-border bg-gradient-to-b from-primary/10 to-transparent px-7 pb-5 pt-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          mundial•pool · {groupName}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Tabla de líderes</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {dateLabel} · {rows.length} {rows.length === 1 ? 'jugador' : 'jugadores'}
        </p>
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          <span className="text-success">✓ aciertos</span>
          <span className="mx-1.5">·</span>
          <span className="text-destructive/80">✗ sin chance</span>
          <span className="mx-1.5">·</span>🚫 selección eliminada
        </p>
      </div>

      <ul className="flex-1 divide-y divide-border">
        {top.map((e) => (
          <StoryRow
            key={e.row.userId}
            entry={e}
            isMe={e.row.userId === currentUserId}
            hasScores={hasScores}
          />
        ))}
        {mineOutsideTop && (
          <>
            <li className="px-6 py-1 text-center font-mono text-xs text-muted-foreground">···</li>
            <StoryRow entry={mineOutsideTop} isMe hasScores={hasScores} />
          </>
        )}
      </ul>

      <div className="mt-auto border-t border-border bg-muted/20 px-7 py-5 text-center">
        {hiddenCount > 0 && (
          <p className="mb-1.5 text-[11px] text-muted-foreground">
            … y {hiddenCount} {hiddenCount === 1 ? 'jugador más' : 'jugadores más'} en la tabla
            completa
          </p>
        )}
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          mundial•pool · Mundial 2026
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">mundial-pool.vercel.app</p>
      </div>
    </div>
  )
}
