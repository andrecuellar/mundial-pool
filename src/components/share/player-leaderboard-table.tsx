'use client'

import { ChevronDown, Share2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { shareDomNodeAsImage } from '@/lib/share-dom'

type Row = {
  id: string
  fullName: string
  goals: number
  assists: number
  teamName: string | null
  teamFlag: string | null
}

type Props = {
  rows: Row[]
  metric: 'goals' | 'assists'
  /** id del nodo capturado por html-to-image. */
  id: string
  /** Texto chico tras "mundial-pool · " en el header de la imagen. */
  label: string
  /** Línea en negrita del header (ej. "Mundial 2026 · 14 jun"). */
  subtitle: string
  fileName: string
  shareTitle: string
  shareText: string
}

const TOP = 20

// Tabla de goleadores/asistentes con cortina: muestra el top 20 y un botón
// para expandir y ver a todos. El botón de compartir captura exactamente lo
// que está visible — top 20 si está contraída, tabla completa si está
// expandida — y su texto lo refleja.
export function PlayerLeaderboardTable({
  rows,
  metric,
  id,
  label,
  subtitle,
  fileName,
  shareTitle,
  shareText,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [pending, setPending] = useState(false)

  const hasMore = rows.length > TOP
  const showingAll = expanded || !hasMore
  const visible = showingAll ? rows : rows.slice(0, TOP)
  const metricLabel = metric === 'goals' ? 'Goles' : 'Asist.'

  async function handleShare() {
    setPending(true)
    const result = await shareDomNodeAsImage({
      targetId: id,
      fileName: showingAll ? `${fileName}-completa` : `${fileName}-top${TOP}`,
      shareTitle,
      shareText,
    })
    setPending(false)
    if (result === 'not-found' || result === 'error') {
      toast.error('No se pudo generar la imagen.')
    } else if (result === 'downloaded') {
      toast.success('Imagen descargada')
    }
  }

  const shareLabel = pending
    ? 'Generando imagen…'
    : showingAll
      ? 'Compartir toda la tabla como imagen'
      : `Compartir top ${TOP} como imagen`

  return (
    <div className="mt-3">
      <div id={id} className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            mundial-pool · {label}
          </p>
          <p className="mt-0.5 text-sm font-semibold tracking-tight">{subtitle}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">Jugador</th>
                <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">Selección</th>
                <th className="px-3 py-2 text-right font-medium">{metricLabel}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/15'}>
                  <td className="px-3 py-2 align-middle">
                    <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums">
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex flex-col">
                      <span className="font-medium">{p.fullName}</span>
                      <span className="text-[11px] text-muted-foreground sm:hidden">
                        {p.teamFlag ?? '🏳️'} {p.teamName ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 align-middle text-xs text-muted-foreground sm:table-cell">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-base leading-none">{p.teamFlag ?? '🏳️'}</span>
                      {p.teamName ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle text-right font-mono font-semibold tabular-nums">
                    {metric === 'goals' ? p.goals : p.assists}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {hasMore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            {expanded ? `Mostrar solo el top ${TOP}` : `Ver todos (${rows.length})`}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </Button>
        )}
        <Button
          type="button"
          onClick={handleShare}
          disabled={pending}
          variant="default"
          size="lg"
          className="w-full"
        >
          <Share2 className="h-3.5 w-3.5" />
          {shareLabel}
        </Button>
      </div>
    </div>
  )
}
