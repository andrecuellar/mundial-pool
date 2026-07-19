import type * as React from 'react'
import type { AllPredictionsPick } from '@/features/predictions/queries'

// Neutral (server-safe) renderer for a single prediction cell. Lives in its
// own module so server components (comprobante page) can import it without
// pulling in the 'use client' boundary of all-predictions-view.

// Badge con el % de aciertos de un pick plural (team_set) ya resuelto: cuántas
// de las selecciones elegidas cayeron en el resultado oficial. Solo se muestra
// cuando la categoría está resuelta (resolvedTeamSet). Verde si acertó todo,
// ámbar si fue parcial, apagado si no acertó ninguna.
function hitRateBadge(correct: number, total: number): React.ReactNode {
  if (total === 0) return null
  const pct = Math.round((correct / total) * 100)
  const tone =
    correct === total
      ? 'text-success border-success/30'
      : correct === 0
        ? 'text-muted-foreground border-border'
        : 'text-warning border-warning/30'
  return (
    <span
      className={`ml-1.5 shrink-0 rounded border px-1 py-0.5 text-[10px] font-semibold tabular-nums ${tone}`}
      title={`${correct} de ${total} aciertos`}
    >
      {correct}/{total} · {pct}%
    </span>
  )
}

export function renderPick(
  p: AllPredictionsPick | undefined,
  opts?: { resolvedTeamSet?: boolean },
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
      </span>
    )
  }
  if (p.kind === 'team_set') {
    // En una categoría resuelta, `dead` de cada equipo significa "no está en el
    // resultado" = fallado; !dead = acierto. Así el % de aciertos sale directo.
    const correct = p.teams.filter((t) => !t.dead).length
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
        {opts?.resolvedTeamSet && hitRateBadge(correct, p.teams.length)}
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
      </span>
    )
  }
  return null
}
