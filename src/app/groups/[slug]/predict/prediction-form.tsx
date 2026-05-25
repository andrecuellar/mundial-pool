'use client'

import { useState, useTransition } from 'react'
import { submitPredictions } from '@/features/predictions/actions'
import type { PredictionFormCategory } from '@/features/predictions/queries'

type Team = { id: string; name: string; flagEmoji: string | null; fifaCode: string | null }

type Props = {
  groupSlug: string
  categories: PredictionFormCategory[]
  teams: Team[]
  locked: boolean
}

function teamLabel(t: Team): string {
  return `${t.flagEmoji ?? '🏳️'} ${t.name}${t.fifaCode ? ` (${t.fifaCode})` : ''}`
}

export function PredictionForm({ groupSlug, categories, teams, locked }: Props) {
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; msg: string }
  >({ kind: 'idle' })
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await submitPredictions(groupSlug, formData)
      if (result.ok) setStatus({ kind: 'saved' })
      else setStatus({ kind: 'error', msg: result.error })
    })
  }

  return (
    <form action={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
      {categories.map((c) => (
        <fieldset
          key={c.id}
          disabled={locked}
          style={{ border: '1px solid #ddd', padding: '1rem' }}
        >
          <legend>
            <strong>{c.name}</strong> · {c.points} pts
          </legend>
          {c.description && <p style={{ color: '#666', margin: '0 0 0.75rem' }}>{c.description}</p>}

          {c.valueKind === 'team' && (
            <select
              name={`cat:${c.key}`}
              defaultValue={c.current?.teamId ?? ''}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              <option value="">— Sin selección —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {teamLabel(t)}
                </option>
              ))}
            </select>
          )}

          {c.valueKind === 'team_set' && (
            <TeamSetPicker
              fieldName={`cat:${c.key}`}
              teams={teams}
              n={(c.metadata as { n?: number } | null)?.n ?? 2}
              defaultValue={c.current?.teamSet ?? []}
            />
          )}

          {c.valueKind === 'player' && (
            <input
              name={`cat:${c.key}`}
              type="text"
              placeholder="Nombre completo del jugador"
              defaultValue={c.current?.playerText ?? ''}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          )}
        </fieldset>
      ))}

      {!locked && (
        <button type="submit" disabled={pending} style={{ padding: '0.75rem' }}>
          {pending ? 'Guardando...' : 'Guardar predicciones'}
        </button>
      )}
      {status.kind === 'saved' && (
        <p style={{ color: 'green' }}>Predicciones guardadas correctamente.</p>
      )}
      {status.kind === 'error' && <p style={{ color: 'crimson' }}>{status.msg}</p>}
    </form>
  )
}

function TeamSetPicker({
  fieldName,
  teams,
  n,
  defaultValue,
}: {
  fieldName: string
  teams: Team[]
  n: number
  defaultValue: string[]
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultValue))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < n) {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div>
      <p style={{ margin: '0 0 0.5rem' }}>
        Selecciona <strong>{n}</strong> equipos. Llevas{' '}
        <strong>
          {selected.size} / {n}
        </strong>
        .
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '0.25rem',
          maxHeight: 220,
          overflowY: 'auto',
          border: '1px solid #eee',
          padding: '0.5rem',
        }}
      >
        {teams.map((t) => {
          const isSelected = selected.has(t.id)
          return (
            <label
              key={t.id}
              style={{
                background: isSelected ? '#e8f5ff' : 'transparent',
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              <input
                type="checkbox"
                name={fieldName}
                value={t.id}
                checked={isSelected}
                onChange={() => toggle(t.id)}
                disabled={!isSelected && selected.size >= n}
              />{' '}
              {teamLabel(t)}
            </label>
          )
        })}
      </div>
    </div>
  )
}
