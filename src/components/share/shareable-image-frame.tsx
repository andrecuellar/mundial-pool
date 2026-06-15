import type { ReactNode } from 'react'
import { ShareComprobanteButton } from '@/components/predictions/share-comprobante-button'

type Props = {
  /** id del nodo capturado por html-to-image. Debe ser único en la página. */
  id: string
  /** Texto chico tras "mundial-pool · " en el header de la imagen. */
  label: string
  /** Línea en negrita del header (ej. "Mundial 2026 · 14 jun"). */
  subtitle: string
  fileName: string
  shareTitle: string
  shareText: string
  children: ReactNode
}

// Envuelve una tabla (u otro contenido) en una tarjeta con header de branding
// y un botón "Compartir como imagen" debajo. El header queda DENTRO de la
// imagen capturada para darle contexto fuera del sitio. Mismo patrón que el
// comprobante y la tabla de líderes; reutiliza ShareComprobanteButton.
export function ShareableImageFrame({
  id,
  label,
  subtitle,
  fileName,
  shareTitle,
  shareText,
  children,
}: Props) {
  return (
    <>
      <div id={id} className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            mundial-pool · {label}
          </p>
          <p className="mt-0.5 text-sm font-semibold tracking-tight">{subtitle}</p>
        </div>
        {children}
      </div>
      <div className="mt-4">
        <ShareComprobanteButton
          targetId={id}
          fileName={fileName}
          shareTitle={shareTitle}
          shareText={shareText}
        />
      </div>
    </>
  )
}
