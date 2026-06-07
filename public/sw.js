// Minimal service worker for mundial-pool: receives Web Push events,
// routes notification clicks, and pre-caches critical assets so Chrome
// considers the site "installable PWA quality" (afecta el Quieter
// Notification UI score). Bump PRECACHE version cuando cambien los assets.

const PRECACHE = 'mp-precache-v1'
const PRECACHE_URLS = ['/', '/manifest.webmanifest', '/icon', '/icon-512']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((c) => c.addAll(PRECACHE_URLS))
      .catch(() => {
        // Si algún asset falla no rompemos el SW — el install completa igual.
      }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Limpiar versiones viejas del precache.
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== PRECACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (_e) {
    data = { title: 'mundial-pool', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'mundial-pool'
  const body = data.body || ''
  const url = data.url || '/'
  const tag = data.tag || undefined

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon',
      badge: '/notification-badge',
      tag,
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Focus an existing tab on the same origin if one matches the target.
      for (const client of all) {
        const url = new URL(client.url)
        if (url.pathname === targetUrl) {
          await client.focus()
          return
        }
      }
      // Otherwise focus any open tab and navigate, or open a fresh window.
      if (all.length > 0) {
        await all[0].focus()
        try {
          await all[0].navigate(targetUrl)
        } catch (_e) {
          /* navigate isn't supported on all browsers; fall through */
        }
        return
      }
      await self.clients.openWindow(targetUrl)
    })(),
  )
})
