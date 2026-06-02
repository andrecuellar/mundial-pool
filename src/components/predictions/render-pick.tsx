import type * as React from 'react'
import type { AllPredictionsPick } from '@/features/predictions/queries'

// Neutral (server-safe) renderer for a single prediction cell. Lives in its
// own module so server components (comprobante page) can import it without
// pulling in the 'use client' boundary of all-predictions-view.
export function renderPick(p: AllPredictionsPick | undefined): React.ReactNode {
  if (!p || p.kind === 'empty') {
    return <span className="text-xs italic text-muted-foreground">Sin respuesta</span>
  }
  if (p.kind === 'team') {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium">
        <span className="text-base leading-none">{p.teamFlag ?? '🏳️'}</span>
        <span>{p.teamName}</span>
      </span>
    )
  }
  if (p.kind === 'team_set') {
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
        {p.teams.map((t) => (
          <span
            key={t.name}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs"
          >
            <span className="leading-none">{t.flag ?? '🏳️'}</span>
            <span className="font-medium">{t.name}</span>
          </span>
        ))}
      </span>
    )
  }
  if (p.kind === 'player') {
    return <span className="font-medium">{p.text}</span>
  }
  return null
}
