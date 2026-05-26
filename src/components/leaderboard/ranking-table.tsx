import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { LeaderboardRow } from '@/features/scoring/queries'

function rankCell(rank: number, isMe: boolean) {
  if (rank === 1) return '🏆'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return (
    <span
      className={`font-mono text-sm font-semibold ${
        isMe ? 'text-primary' : 'text-muted-foreground'
      }`}
    >
      #{rank}
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

export function RankingTable({
  rows,
  currentUserId,
}: {
  rows: LeaderboardRow[]
  currentUserId: string
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <div className="flex items-center gap-5">
          <span className="w-8">#</span>
          <span>Jugador</span>
        </div>
        <span className="w-16 text-right">Puntos</span>
      </div>
      {rows.map((r, i) => {
        const rank = i + 1
        const isMe = r.userId === currentUserId
        return (
          <div
            key={r.userId}
            className={`flex items-center justify-between border-t border-border px-5 py-3 first:border-t-0 ${
              isMe ? 'bg-primary/5 border-l-2 border-l-primary' : ''
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid w-8 place-items-center text-base">{rankCell(rank, isMe)}</span>
              <Avatar className="h-8 w-8">
                {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt={r.displayName} />}
                <AvatarFallback className="text-xs">{initials(r.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{r.displayName}</span>
                  {isMe && (
                    <Badge
                      variant="secondary"
                      className="border-primary/20 bg-primary/10 text-primary"
                    >
                      Tú
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <span
              className={`w-16 text-right font-mono text-lg font-semibold tabular-nums ${
                isMe ? 'text-primary' : 'text-foreground'
              }`}
            >
              {r.totalPoints}
            </span>
          </div>
        )
      })}
    </Card>
  )
}
