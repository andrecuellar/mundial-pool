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
// The wrapper has aspect-square sizing; the image and skeleton are both
// position:absolute inside so the wrapper alone reserves layout space — no
// shift when the image swaps in, and nothing escapes into surrounding flow.
export function QrImage({ src, alt, className }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  return (
    <div
      className={`relative isolate block aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted/30 ${className ?? ''}`}
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
        <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-muted-foreground">
          No se pudo cargar el QR.
        </div>
      ) : (
        // biome-ignore lint/performance/noImgElement: external QR (Supabase storage URL)
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  )
}
