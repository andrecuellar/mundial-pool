'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// Catches anything that bubbles past route-level error boundaries and would
// otherwise leave the user with a blank page. Has to declare its own <html>
// and <body> because it replaces the root layout when active.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background: '#16181F',
          color: '#F5F4ED',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <p
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#9CA3AF',
              margin: '0 0 12px',
            }}
          >
            mundial-pool
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 12px' }}>
            Algo salió mal cargando la app
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#9CA3AF', margin: '0 0 24px' }}>
            Esto se reportó automáticamente. Puedes intentar de nuevo. Si sigue fallando, cierra la
            app y vuelve a abrirla, o limpia los datos del sitio en tu navegador.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                padding: '10px 16px',
                background: '#4F7DDC',
                color: '#F5F4ED',
                border: 0,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Intentar de nuevo
            </button>
            <a
              href="/"
              style={{
                padding: '10px 16px',
                background: 'transparent',
                color: '#F5F4ED',
                border: '1px solid #2A2D36',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Ir al inicio
            </a>
          </div>
          {error.digest && (
            <p
              style={{
                marginTop: 24,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 11,
                color: '#6B7280',
              }}
            >
              ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
