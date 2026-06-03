'use client'

import { track } from '@vercel/analytics'
import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  type BeforeInstallPromptEvent,
  DesktopInstallDialog,
  IosInstallDialog,
  isIos,
  isStandalone,
} from './install-dialogs'

// Chrome/Edge: returns installed PWAs that match the current origin. Empty
// array (or no API) means we can't confirm — we still show the link in that
// case. Safari iOS has no equivalent — there we rely on the iOS dialog.
async function isPwaAlreadyInstalled(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<unknown[]>
  }
  if (typeof nav.getInstalledRelatedApps !== 'function') return false
  try {
    const apps = await nav.getInstalledRelatedApps()
    return Array.isArray(apps) && apps.length > 0
  } catch {
    return false
  }
}

// Permanent link in the footer that opens the PWA install flow on demand.
// Counterpart to <InstallPrompt /> (the timed banner). This one is always
// visible so users who dismissed the banner — or already-onboarded users
// who decide they want the app — have a clear entry point. Hidden when the
// PWA is already installed (either browsing inside it, or installed but
// currently in the browser).
export function InstallAppLink() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(false)
  const [iosDialogOpen, setIosDialogOpen] = useState(false)
  const [desktopDialogOpen, setDesktopDialogOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) {
      setHidden(true)
      return
    }

    let mounted = true
    isPwaAlreadyInstalled().then((installed) => {
      if (mounted && installed) setHidden(true)
    })

    const handler = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const onInstalled = () => setHidden(true)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      mounted = false
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (hidden) return null

  async function install() {
    if (isIos()) {
      track('pwa_install_clicked', { platform: 'ios', source: 'footer' })
      setIosDialogOpen(true)
      return
    }
    if (event) {
      track('pwa_install_clicked', { platform: 'web', source: 'footer' })
      await event.prompt()
      const { outcome } = await event.userChoice
      if (outcome === 'accepted') {
        track('pwa_installed', { platform: 'web', source: 'footer' })
        setEvent(null)
      } else {
        track('pwa_install_dismissed', { platform: 'web', source: 'footer' })
      }
      return
    }
    track('pwa_install_clicked', { platform: 'desktop-fallback', source: 'footer' })
    setDesktopDialogOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
      >
        <Download className="h-3 w-3" />
        Instalar app
      </button>

      <IosInstallDialog open={iosDialogOpen} onOpenChange={setIosDialogOpen} />
      <DesktopInstallDialog open={desktopDialogOpen} onOpenChange={setDesktopDialogOpen} />
    </>
  )
}
