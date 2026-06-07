import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Manifest debe revalidar siempre — cambios cosméticos (icons,
      // categorías, screenshots) deben verse al instante en el siguiente
      // load, sin esperar al TTL de cache.
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      // SW debe revalidar para que el deploy nuevo no quede sirviendo el
      // SW viejo en clientes con la PWA instalada.
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      // assetlinks.json puede cachear hasta 1h. Lo verifica Android Chrome
      // al abrir el TWA — no necesita ser instant.
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'application/json' },
        ],
      },
      // APK del TWA descargable desde /instalar. Content-Type específico
      // para que Android lo abra con el installer, no que el browser lo
      // muestre como texto. noindex para que no aparezca en buscadores.
      {
        source: '/downloads/mundial-pool.apk',
        headers: [
          { key: 'Content-Type', value: 'application/vnd.android.package-archive' },
          {
            key: 'Content-Disposition',
            value: 'attachment; filename="mundial-pool.apk"',
          },
          { key: 'Cache-Control', value: 'public, max-age=86400' },
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? 'mundial-pool',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  reactComponentAnnotation: { enabled: true },
  tunnelRoute: '/monitoring',
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  disableLogger: true,
  automaticVercelMonitors: false,
  telemetry: false,
})
