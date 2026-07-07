import { AlertTriangle, CheckCircle2, Wallet, XCircle } from 'lucide-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { RankedLeaderboardRow } from '@/features/scoring/queries'
import { competitionRanks, type RankInfo } from '@/features/scoring/rank'
import { formatDayShort } from '@/lib/format'

export type PaidAt = { userId: string; paidAt: string }

function rankCell(info: RankInfo, isMe: boolean, hasScores: boolean) {
  if (hasScores && !info.tied) {
    if (info.rank === 1) return '🏆'
    if (info.rank === 2) return '🥈'
    if (info.rank === 3) return '🥉'
  }
  return (
    <span
      className={`inline-flex min-w-[2rem] items-center justify-center whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
        isMe
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-muted/40 text-muted-foreground'
      }`}
      title={info.tied ? `Empate por el puesto ${info.rank}` : `Puesto ${info.rank}`}
    >
      {info.rank}
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
  rows: RankedLeaderboardRow[]
  currentUserId: string
  poolEnabled: boolean
  paidAt: PaidAt[]
  lockAt: string
  groupSlug: string
  isAdmin: boolean
}

export function RankingTable({
  rows,
  currentUserId,
  poolEnabled,
  paidAt,
  lockAt,
  groupSlug,
  isAdmin,
}: Props) {
  const hasScores = rows.some((r) => r.totalPoints > 0)
  const ranks = competitionRanks(rows)
  const paidAtByUser = new Map(paidAt.map((p) => [p.userId, new Date(p.paidAt)]))
  const paidCount = poolEnabled ? rows.filter((r) => paidAtByUser.has(r.userId)).length : 0
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
          const paidWhen = paidAtByUser.get(r.userId) ?? null
          const hasPaid = paidWhen !== null
          const paidLate = hasPaid && paidWhen > lockDate
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
                        paidLate ? (
                          <Badge
                            variant="secondary"
                            className="border-destructive/40 bg-destructive/10 text-destructive gap-1"
                            title={`Pago registrado ${formatDayShort(paidWhen)}, después del cierre del ${formatDayShort(lockDate)}`}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Pagó tarde
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="border-accent/30 bg-accent/10 text-accent gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Aportó
                          </Badge>
                        )
                      ) : locked ? (
                        <Badge
                          variant="secondary"
                          className="border-destructive/40 bg-destructive/10 text-destructive gap-1"
                          title="No aportó al pozo antes del cierre del grupo"
                        >
                          <XCircle className="h-3 w-3" />
                          No pagó
                        </Badge>
                      ) : (
                        <Link
                          href={
                            isAdmin
                              ? `/groups/${groupSlug}/admin/pool`
                              : `/groups/${groupSlug}#pozo`
                          }
                          aria-label={isAdmin ? 'Registrar este aporte' : 'Cómo aportar al pozo'}
                        >
                          <Badge
                            variant="secondary"
                            className="border-warning/40 bg-warning/10 text-warning gap-1 transition-colors hover:bg-warning/20"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Pendiente
                          </Badge>
                        </Link>
                      ))}
                  </div>
                  {hasScores && (
                    <p
                      className="mt-0.5 font-mono text-[10px] text-muted-foreground"
                      title={`${r.correctCount} aciertos · ${r.failedCount} predicciones sin chance`}
                    >
                      <span className="text-success">✓{r.correctCount}</span>
                      <span className="mx-1">·</span>
                      <span className="text-destructive/80">✗{r.failedCount}</span>
                    </p>
                  )}
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
            después del cierre del{' '}
            <span className="font-medium text-foreground">{formatDayShort(lockDate)}</span> quienes
            no hayan aportado quedan marcados como{' '}
            <span className="font-medium text-destructive">No pagó</span> en la tabla y fuera del
            reparto del premio.
          </p>
        </div>
      )}
    </div>
  )
}
