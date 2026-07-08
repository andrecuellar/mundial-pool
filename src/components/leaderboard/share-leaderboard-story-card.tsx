import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { RankedLeaderboardRow } from '@/features/scoring/queries'
import { competitionRanks } from '@/features/scoring/rank'

// Poster off-screen en formato story vertical (540×≥1140 ≈ 9:19, entre 9:16 y
// 9:21) que se captura como imagen desde el botón "Compartir para historias"
// de la tabla de líderes. Cada jugador lleva una tira de una celda por
// categoría (estilo Wordle): ✓ acertada, ✗ sin chance, … todavía en juego.
// Con encabezados cortos arriba se entiende QUÉ categoría falló cada uno sin
// necesidad de leyendas largas. Solo entran los primeros MAX_ROWS puestos
// (+ la fila propia si queda fuera).

const MAX_ROWS = 12

// Encabezado corto por categoría (máx 4 chars para que entren 14 columnas en
// 540px). Fallback: primeras 3 letras del key.
const CATEGORY_ABBR: Record<string, string> = {
  champion: 'CAM',
  runner_up: 'SUB',
  third_place: '3RO',
  finalists: 'FIN',
  top_5: 'TOP5',
  revelation: 'REV',
  disappointment: 'DEC',
  top_scoring_team: '+GOL',
  most_conceded_team: '-GOL',
  top_scorer_player: 'BOTA',
  top_assists_player: 'ASIS',
  golden_ball: 'BAL',
  golden_glove: 'GUAN',
  young_player: 'JOV',
}

function abbr(key: string): string {
  return CATEGORY_ABBR[key] ?? key.slice(0, 3).toUpperCase()
}

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

function rankLabel(rank: number, tied: boolean, hasScores: boolean): string {
  if (hasScores && !tied) {
    if (rank === 1) return '🏆'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
  }
  return `${rank}`
}

type StoryCategory = { id: string; key: string; name: string }

type CellStatus = 'won' | 'dead' | 'alive'

function cellFor(status: CellStatus, key: string) {
  if (status === 'won') {
    return (
      <span key={key} className="w-[29px] text-center text-[13px] font-semibold text-success">
        ✓
      </span>
    )
  }
  if (status === 'dead') {
    return (
      <span
        key={key}
        className="w-[29px] text-center text-[13px] font-semibold text-destructive/80"
      >
        ✗
      </span>
    )
  }
  return (
    <span key={key} className="w-[29px] text-center text-[13px] text-muted-foreground/70">
      …
    </span>
  )
}

type StoryEntry = { row: RankedLeaderboardRow; rank: number; tied: boolean }

function StoryRow({
  entry,
  isMe,
  hasScores,
  categories,
  statusFor,
}: {
  entry: StoryEntry
  isMe: boolean
  hasScores: boolean
  categories: StoryCategory[]
  statusFor: (row: RankedLeaderboardRow, categoryId: string) => CellStatus
}) {
  const { row, rank, tied } = entry
  return (
    <li className={`px-6 py-2.5 ${isMe ? 'bg-primary/10' : ''}`}>
      <div className="flex items-center gap-2.5">
        <span className="grid w-7 shrink-0 place-items-center font-mono text-base font-semibold tabular-nums">
          {rankLabel(rank, tied, hasScores)}
        </span>
        <Avatar className="h-7 w-7 shrink-0">
          {row.avatarUrl && <AvatarImage src={row.avatarUrl} alt={row.displayName} />}
          <AvatarFallback className="text-[10px]">{initials(row.displayName)}</AvatarFallback>
        </Avatar>
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight">
          {row.displayName}
        </p>
        <span className="shrink-0 text-right font-mono text-lg font-bold tabular-nums">
          {row.totalPoints}
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">pts</span>
        </span>
      </div>
      <div className="mt-1 flex pl-[76px]">
        {categories.map((c) => cellFor(statusFor(row, c.id), c.id))}
      </div>
    </li>
  )
}

type Props = {
  /** Must match the `targetId` passed to the share button. */
  id: string
  groupName: string
  rows: RankedLeaderboardRow[]
  categories: StoryCategory[]
  resolvedCategoryIds: string[]
  lostByUser: Record<string, string[]>
  currentUserId: string
  dateLabel: string
}

export function ShareLeaderboardStoryCard({
  id,
  groupName,
  rows,
  categories,
  resolvedCategoryIds,
  lostByUser,
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

  const resolvedSet = new Set(resolvedCategoryIds)
  const lostSets = new Map(Object.entries(lostByUser).map(([uid, ids]) => [uid, new Set(ids)]))
  // Misma regla que las celdas del detalle: puntos > 0 → acertada; 0 definitivo
  // (resuelta sin acierto o pick imposible) → muerta; el resto sigue en juego.
  const statusFor = (row: RankedLeaderboardRow, categoryId: string): CellStatus => {
    const pts = row.breakdown[categoryId] ?? 0
    if (pts > 0) return 'won'
    if (resolvedSet.has(categoryId) || lostSets.get(row.userId)?.has(categoryId)) return 'dead'
    return 'alive'
  }

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
          <span className="text-success">✓ acertada</span>
          <span className="mx-1.5">·</span>
          <span className="text-destructive/80">✗ sin chance</span>
          <span className="mx-1.5">·</span>… en juego
        </p>
      </div>

      <div className="border-b border-border bg-muted/30 px-6 py-1.5">
        <div className="flex pl-[76px]">
          {categories.map((c) => (
            <span
              key={c.id}
              title={c.name}
              className="w-[29px] text-center font-mono text-[8px] uppercase tracking-tight text-muted-foreground"
            >
              {abbr(c.key)}
            </span>
          ))}
        </div>
      </div>

      <ul className="flex-1 divide-y divide-border">
        {top.map((e) => (
          <StoryRow
            key={e.row.userId}
            entry={e}
            isMe={e.row.userId === currentUserId}
            hasScores={hasScores}
            categories={categories}
            statusFor={statusFor}
          />
        ))}
        {mineOutsideTop && (
          <>
            <li className="px-6 py-1 text-center font-mono text-xs text-muted-foreground">···</li>
            <StoryRow
              entry={mineOutsideTop}
              isMe
              hasScores={hasScores}
              categories={categories}
              statusFor={statusFor}
            />
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
