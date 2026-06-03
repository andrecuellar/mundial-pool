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

// Permanent link in the footer that opens the PWA install flow on demand.
// Counterpart to <InstallPrompt /> (the timed banner). This one is always
// visible so users who dismissed the banner — or already-onboarded users
// who decide they want the app — have a clear entry point.
export function InstallAppLink() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [iosDialogOpen, setIosDialogOpen] = useState(false)
  const [desktopDialogOpen, setDesktopDialogOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setStandalone(isStandalone())

    const handler = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const onInstalled = () => setStandalone(true)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // If the app is already installed and the user is browsing inside the
  // installed PWA, hide the link — no point offering to install what's open.
  if (standalone) return null

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
