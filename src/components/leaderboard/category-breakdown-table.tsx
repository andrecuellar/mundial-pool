import { XCircle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { RankedLeaderboardRow } from '@/features/scoring/queries'

type Category = { id: string; name: string; key: string; points: number }

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

export function CategoryBreakdownTable({
  rows,
  categories,
  resolvedCategoryIds,
  lostByUser,
  currentUserId,
  poolEnabled,
}: {
  rows: RankedLeaderboardRow[]
  categories: Category[]
  resolvedCategoryIds: string[]
  lostByUser: Record<string, string[]>
  currentUserId: string
  poolEnabled: boolean
}) {
  const resolvedSet = new Set(resolvedCategoryIds)
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-center">#</th>
              <th className="px-4 py-3 text-left">Jugador</th>
              {categories.map((c, i) => (
                <th key={c.id} className="px-2 py-3 text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-mono tracking-wider cursor-help">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {c.name} · {c.points} pts
                    </TooltipContent>
                  </Tooltip>
                </th>
              ))}
              <th className="px-4 py-3 text-right text-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = r.userId === currentUserId
              const lostSet = new Set(lostByUser[r.userId] ?? [])
              return (
                <tr
                  key={r.userId}
                  className={`border-t border-border ${isMe ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-4 py-3 text-center font-mono text-xs font-semibold text-muted-foreground">
                    #{i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-6 w-6">
                        {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt={r.displayName} />}
                        <AvatarFallback className="text-[10px]">
                          {initials(r.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{r.displayName}</span>
                      {poolEnabled && r.hasPaid === false && (
                        <Badge
                          variant="outline"
                          className="shrink-0 gap-1 border-destructive/30 text-destructive"
                          title="No aportó al pozo"
                        >
                          <XCircle className="h-3 w-3" />
                          No pagó
                        </Badge>
                      )}
                    </div>
                  </td>
                  {categories.map((c) => {
                    const pts = r.breakdown[c.id] ?? 0
                    const full = pts === c.points
                    // Definitivo con 0 puntos: categoría ya resuelta sin acierto,
                    // o pick muerto (equipo/jugador sin chance matemática).
                    const dead = pts === 0 && (resolvedSet.has(c.id) || lostSet.has(c.id))
                    return (
                      <td
                        key={c.id}
                        className={`px-2 py-3 text-center font-mono text-sm ${
                          dead
                            ? 'text-destructive/70'
                            : pts === 0
                              ? 'text-muted-foreground'
                              : full
                                ? 'text-success font-semibold'
                                : 'text-foreground'
                        }`}
                      >
                        {pts > 0 ? pts : dead ? 0 : '—'}
                      </td>
                    )
                  })}
                  <td
                    className={`px-4 py-3 text-right font-mono text-base font-semibold tabular-nums ${
                      isMe ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {r.totalPoints}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-3 text-[11px] text-muted-foreground">
        <span>Pasa el cursor sobre el número de categoría para ver el nombre completo.</span>
        <span className="shrink-0 text-right font-mono">
          verde = acierto · <span className="text-destructive/70">0</span> = sin chance · — = en
          juego
        </span>
      </div>
    </Card>
  )
}
