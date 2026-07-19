'use client'

import * as Sentry from '@sentry/nextjs'
import { RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Error boundary ACOTADO a /groups/[slug]. Antes, cualquier throw aquí (una
// query colgada que revienta por timeout) burbujeaba hasta global-error y
// tumbaba toda la app. Ahora se contiene: reintentamos una vez de forma
// automática — los cuelgues de conexión suelen curarse al segundo intento
// porque agarra un socket fresco — y si persiste mostramos el botón.
export default function GroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    Sentry.captureException(error)

    // Auto-reintento único por episodio. Sello de tiempo en sessionStorage para
    // no entrar en loop si el error es persistente: solo reintenta si pasaron
    // >20s desde el último auto-reintento.
    try {
      const KEY = 'mp:group-error-last-retry'
      const last = Number(sessionStorage.getItem(KEY) || 0)
      if (Date.now() - last > 20_000) {
        sessionStorage.setItem(KEY, String(Date.now()))
        setRetrying(true)
        const t = setTimeout(() => reset(), 700)
        return () => clearTimeout(t)
      }
    } catch {
      // sessionStorage no disponible — mostramos el botón manual.
    }
  }, [error, reset])

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-4 py-16 sm:px-6">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted">
          <RefreshCw
            className={`h-5 w-5 text-muted-foreground ${retrying ? 'animate-spin' : ''}`}
          />
        </div>
        <h1 className="mt-4 text-lg font-semibold">
          {retrying ? 'Reintentando…' : 'No pudimos cargar el grupo'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {retrying
            ? 'Dame un segundo, estoy reconectando.'
            : 'La conexión con el servidor tardó demasiado. Suele resolverse al reintentar.'}
        </p>
        {!retrying && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button
              onClick={() => {
                setRetrying(true)
                reset()
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Ir al inicio</Link>
            </Button>
          </div>
        )}
        {error.digest && !retrying && (
          <p className="mt-6 font-mono text-[11px] text-muted-foreground/70">ref: {error.digest}</p>
        )}
      </Card>
    </main>
  )
}
