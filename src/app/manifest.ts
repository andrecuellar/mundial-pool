import type { MetadataRoute } from 'next'

// Single source of truth for the PWA / TWA. Consumed by:
//  - Chrome / Edge / Safari to install the PWA (icons, theme, scope).
//  - PWABuilder.com to generate the Android APK/AAB (id, categories,
//    screenshots, maskable icons).
//  - Google Play Store listing (description, screenshots, categories).
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Identidad
    id: '/',
    name: 'mundial-pool',
    short_name: 'mundial-pool',
    description: 'El pool del Mundial 2026 entre amigos',
    lang: 'es',
    dir: 'ltr',

    // Navegación
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',

    // Colores
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',

    // Play Store
    categories: ['sports', 'entertainment', 'social'],
    prefer_related_applications: false,

    // Icons: 'any' para el sistema (square, full bleed) + 'maskable' para
    // Android adaptive icons (con safe zone para que la máscara del OS no
    // recorte el design).
    icons: [
      { src: '/icon', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],

    // Screenshots para el listing del Play Store. Mínimo 1 narrow (mobile)
    // + 1 wide (desktop) recomendado. PWABuilder usa estos para auto-armar
    // las screens del store en el primer onboarding.
    screenshots: [
      {
        src: '/screenshots/login-narrow.png',
        sizes: '540x720',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'mundial-pool · El pool del Mundial 2026',
      },
      {
        src: '/screenshots/welcome-splash-narrow.png',
        sizes: '540x720',
        type: 'image/png',
        form_factor: 'narrow',
        label: '¿Quién quiere predecir esto? 🤌🏽',
      },
      {
        src: '/screenshots/login-wide.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: 'mundial-pool · El pool del Mundial 2026',
      },
    ],
  }
}
