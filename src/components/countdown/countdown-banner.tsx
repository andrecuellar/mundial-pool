'use client'

import { AlertTriangle, Clock, Flame } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  /** ISO timestamp of the predictions lock. */
  lockAt: string
  /** Group name to show in critical state. */
  groupName?: string
  /** Optional tail context shown next to the count. */
  context?: string
}

type Remaining = {
  totalMs: number
  days: number
  hours: number
  minutes: number
  seconds: number
}

function compute(target: number): Remaining {
  const totalMs = target - Date.now()
  if (totalMs <= 0) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }
  }
  const totalSec = Math.floor(totalMs / 1000)
  return {
    totalMs,
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  }
}

export function CountdownBanner({ lockAt, groupName, context }: Props) {
  const target = Date.parse(lockAt)
  const [r, setR] = useState<Remaining>(() => compute(target))

  useEffect(() => {
    if (!Number.isFinite(target)) return
    if (r.totalMs <= 0) return
    // Tick every second when <1h, every minute otherwise.
    const interval = r.totalMs < 60 * 60 * 1000 ? 1000 : 60 * 1000
    const id = setInterval(() => setR(compute(target)), interval)
    return () => clearInterval(id)
  }, [target, r.totalMs])

  if (!Number.isFinite(target) || r.totalMs <= 0) return null

  // < 1 hour: critical banner with pulsing red border + ticking seconds.
  if (r.totalMs < 60 * 60 * 1000) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 shadow-[0_0_0_4px_color-mix(in_oklab,var(--destructive)_8%,transparent)] animate-pulse">
        <div className="flex items-start gap-3">
          <Flame className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">¡Últimos minutos!</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cierre {groupName ? `de ${groupName}` : ''} en{' '}
              <span className="font-mono font-medium tabular-nums text-destructive">
                {r.hours > 0 && `${r.hours}h `}
                {r.minutes}m {String(r.seconds).padStart(2, '0')}s
              </span>
              {context ? ` · ${context}` : ''}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // < 24 hours: warning banner.
  if (r.totalMs < 24 * 60 * 60 * 1000) {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning animate-pulse" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Falta menos de 24 horas</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cierre {groupName ? `de ${groupName}` : ''} en{' '}
              <span className="font-mono font-medium tabular-nums text-foreground">
                {r.hours}h {String(r.minutes).padStart(2, '0')}m
              </span>
              {context ? ` · ${context}` : ''}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 1-7 days: medium primary card.
  if (r.totalMs < 7 * 24 * 60 * 60 * 1000) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Faltan {r.days} {r.days === 1 ? 'día' : 'días'} para cerrar
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {groupName ? `${groupName} · ` : ''}
              <span className="font-mono tabular-nums">
                {r.days}d {r.hours}h {String(r.minutes).padStart(2, '0')}m
              </span>
              {context ? ` · ${context}` : ''}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // > 7 days: small muted chip.
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs">
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">
        {groupName ? `${groupName}: ` : ''}faltan{' '}
        <span className="font-mono font-medium tabular-nums text-foreground">
          {r.days} {r.days === 1 ? 'día' : 'días'}
        </span>
        {context ? ` · ${context}` : ''}
      </span>
    </div>
  )
}
