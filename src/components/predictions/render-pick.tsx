import type * as React from 'react'
import type { AllPredictionsPick } from '@/features/predictions/queries'

// Neutral (server-safe) renderer for a single prediction cell. Lives in its
// own module so server components (comprobante page) can import it without
// pulling in the 'use client' boundary of all-predictions-view.

// Badge con la probabilidad (0..1) de que el pick gane su categoría. null/undefined
// = categoría no modelada (jurado). El color marca al favorito.
function probBadge(prob: number | null | undefined): React.ReactNode {
  if (prob == null) return null
  const pct = Math.round(prob * 100)
  const label = prob > 0 && pct < 1 ? '<1%' : `${pct}%`
  const tone =
    prob >= 0.6
      ? 'text-success border-success/30'
      : prob >= 0.25
        ? 'text-foreground border-border'
        : 'text-muted-foreground border-border'
  return (
    <span
      className={`ml-1.5 shrink-0 rounded border px-1 py-0.5 text-[10px] font-semibold tabular-nums ${tone}`}
      title="Probabilidad de ganar esta categoría"
    >
      {label}
    </span>
  )
}

export function renderPick(
  p: AllPredictionsPick | undefined,
  prob?: number | null,
): React.ReactNode {
  if (!p || p.kind === 'empty') {
    return <span className="text-xs italic text-muted-foreground">Sin respuesta</span>
  }
  if (p.kind === 'team') {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium">
        <span className={`text-base leading-none ${p.dead ? 'opacity-50' : ''}`}>
          {p.teamFlag ?? '🏳️'}
        </span>
        <span
          className={p.dead ? 'text-muted-foreground line-through decoration-destructive/60' : ''}
        >
          {p.teamName}
        </span>
        {probBadge(prob)}
      </span>
    )
  }
  if (p.kind === 'team_set') {
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
        {p.teams.map((t) => (
          <span
            key={t.name}
            className={`inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs ${
              t.dead ? 'opacity-60' : ''
            }`}
          >
            <span className="leading-none">{t.flag ?? '🏳️'}</span>
            <span
              className={`font-medium ${
                t.dead ? 'text-muted-foreground line-through decoration-destructive/60' : ''
              }`}
            >
              {t.name}
            </span>
          </span>
        ))}
        {probBadge(prob)}
      </span>
    )
  }
  if (p.kind === 'player') {
    return (
      <span className="inline-flex items-center">
        <span
          className={`font-medium ${
            p.dead ? 'text-muted-foreground line-through decoration-destructive/60' : ''
          }`}
        >
          {p.text}
        </span>
        {probBadge(prob)}
      </span>
    )
  }
  return null
}
