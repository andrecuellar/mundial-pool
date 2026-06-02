import { AlertTriangle, CheckCircle2, Wallet } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { LeaderboardRow } from '@/features/scoring/queries'
import { formatDayShort } from '@/lib/format'

type RankInfo = { rank: number; tied: boolean }

function competitionRanks(rows: LeaderboardRow[]): RankInfo[] {
  // Same total points share a rank, the next rank skips by the tie size
  // (1, 1, 3, 3, 5). Matches the rule used to split the pool.
  const out: RankInfo[] = []
  let prevPoints: number | null = null
  let prevRank = 0
  rows.forEach((r, i) => {
    const rank = prevPoints !== null && r.totalPoints === prevPoints ? prevRank : i + 1
    out.push({ rank, tied: false })
    prevPoints = r.totalPoints
    prevRank = rank
  })
  for (let i = 0; i < out.length; i++) {
    const same = out.filter((x) => x.rank === out[i].rank).length
    out[i].tied = same > 1
  }
  return out
}

function rankCell(info: RankInfo, isMe: boolean, hasScores: boolean) {
  if (hasScores && !info.tied) {
    if (info.rank === 1) return '🏆'
    if (info.rank === 2) return '🥈'
    if (info.rank === 3) return '🥉'
  }
  return (
    <span
      className={`font-mono text-sm font-semibold ${
        isMe ? 'text-primary' : 'text-muted-foreground'
      }`}
    >
      {info.tied ? `T-${info.rank}` : `#${info.rank}`}
    </span>
  )
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

type Props = {
  rows: LeaderboardRow[]
  currentUserId: string
  poolEnabled: boolean
  paidUserIds: string[]
  lockAt: string
}

export function RankingTable({ rows, currentUserId, poolEnabled, paidUserIds, lockAt }: Props) {
  const hasScores = rows.some((r) => r.totalPoints > 0)
  const ranks = competitionRanks(rows)
  const paidSet = new Set(paidUserIds)
  const paidCount = poolEnabled ? rows.filter((r) => paidSet.has(r.userId)).length : 0
  const pendingCount = poolEnabled ? rows.length - paidCount : 0
  const lockDate = new Date(lockAt)
  const locked = Date.now() >= lockDate.getTime()

  return (
    <div className="space-y-3">
      {poolEnabled && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
          <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">
            {paidCount} de {rows.length} aportaron
          </span>
          {pendingCount > 0 && (
            <span className="text-muted-foreground">
              · <span className="text-warning">{pendingCount} pendientes</span>
            </span>
          )}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="flex items-center gap-5">
            <span className="w-8">#</span>
            <span>Jugador</span>
          </div>
          <span className="w-16 text-right">Puntos</span>
        </div>
        {rows.map((r, i) => {
          const info = ranks[i]
          const isMe = r.userId === currentUserId
          const hasPaid = paidSet.has(r.userId)
          return (
            <div
              key={r.userId}
              className={`flex items-center justify-between gap-3 border-t border-border px-5 py-3 first:border-t-0 ${
                isMe ? 'bg-primary/5 border-l-2 border-l-primary' : ''
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid w-8 place-items-center text-base">
                  {rankCell(info, isMe, hasScores)}
                </span>
                <Avatar className="h-8 w-8">
                  {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt={r.displayName} />}
                  <AvatarFallback className="text-xs">{initials(r.displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{r.displayName}</span>
                    {isMe && (
                      <Badge
                        variant="secondary"
                        className="border-primary/20 bg-primary/10 text-primary"
                      >
                        Tú
                      </Badge>
                    )}
                    {poolEnabled &&
                      (hasPaid ? (
                        <Badge
                          variant="secondary"
                          className="border-accent/30 bg-accent/10 text-accent gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Aportó
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="border-warning/40 bg-warning/10 text-warning gap-1"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Pendiente
                        </Badge>
                      ))}
                  </div>
                </div>
              </div>
              <span
                className={`shrink-0 w-16 text-right font-mono text-lg font-semibold tabular-nums ${
                  isMe ? 'text-primary' : 'text-foreground'
                }`}
              >
                {r.totalPoints}
              </span>
            </div>
          )
        })}
      </Card>

      {poolEnabled && pendingCount > 0 && !locked && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs leading-relaxed">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">
              Aviso para los {pendingCount} pendientes:
            </span>{' '}
            quienes no aporten al pozo antes del cierre del{' '}
            <span className="font-medium text-foreground">{formatDayShort(lockDate)}</span> podrán
            ser eliminados de la tabla por el administrador del grupo y quedarán fuera del reparto
            del premio.
          </p>
        </div>
      )}
    </div>
  )
}
