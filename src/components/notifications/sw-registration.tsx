'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker as soon as the app loads. Two reasons:
 *  1. PWA install eligibility — Chrome requires a registered SW.
 *  2. Push notifications are ready to receive even before the user opts in
 *     via the in-app banner.
 *
 * No-op on browsers without serviceWorker support.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Defer slightly so the page paint isn't blocked.
    const id = window.setTimeout(() => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((e) => console.error('SW register failed', e))
    }, 1500)
    return () => window.clearTimeout(id)
  }, [])
  return null
}
