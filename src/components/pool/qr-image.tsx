'use client'

import { QrCode } from 'lucide-react'
import { useState } from 'react'

type Props = {
  src: string
  alt: string
  /** Tailwind classes appended to the wrapper aspect-square container. */
  className?: string
}

// Shared QR image with a skeleton + spinner while the upstream image loads.
// Used in PoolQrDialog (member view) and QrUploadCard (owner view) so the load
// state looks the same everywhere.
export function QrImage({ src, alt, className }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted/30 ${className ?? ''}`}
    >
      {!loaded && !errored && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="animate-pulse text-muted-foreground">
            <QrCode className="h-10 w-10" aria-hidden />
          </div>
          <span className="sr-only">Cargando QR…</span>
        </div>
      )}
      {errored ? (
        <div className="absolute inset-0 grid place-items-center text-center text-xs text-muted-foreground p-4">
          No se pudo cargar el QR.
        </div>
      ) : (
        // biome-ignore lint/performance/noImgElement: external QR (Supabase storage URL)
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`h-full w-full object-contain transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  )
}
