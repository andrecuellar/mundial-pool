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
    // Register immediately so Chrome's PWA install eligibility (which needs
    // an active SW) is met as early as possible. Non-blocking — the promise
    // doesn't gate any other work.
    //
    // We log failures as warnings, not errors. In-app browsers (Google App,
    // Facebook, Instagram, Twitter) frequently reject SW registration via
    // their custom webview proxy — that's expected, the app still works.
    // Real outages would surface as 500s on /sw.js in Vercel logs.
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW register failed', e))
  }, [])
  return null
}
