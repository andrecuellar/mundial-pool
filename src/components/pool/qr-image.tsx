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

  const showLoadingChrome = !loaded && !errored

  return (
    <div
      className={`relative isolate block aspect-square w-full overflow-hidden rounded-lg border-2 bg-muted/30 ${
        showLoadingChrome ? 'mp-qr-border' : 'border-border'
      } ${className ?? ''}`}
    >
      {showLoadingChrome && (
        <>
          {/* Scanline traveling top → bottom. */}
          <div
            className="mp-qr-scan pointer-events-none absolute inset-x-0 top-0 z-10 h-1/12 bg-gradient-to-b from-transparent via-primary/70 to-transparent"
            aria-hidden
          />
          {/* Icon that breathes in/out. */}
          <div className="absolute inset-0 grid place-items-center">
            <div className="mp-qr-icon text-primary/70">
              <QrCode className="h-12 w-12" aria-hidden strokeWidth={1.5} />
            </div>
          </div>
          <span className="sr-only">Cargando QR…</span>
        </>
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
