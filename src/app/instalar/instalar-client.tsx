'use client'

import { track } from '@vercel/analytics'
import { Apple, Check, Copy, Download, Globe, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

type Platform = 'android' | 'ios' | 'desktop' | 'unknown'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua) || (navigator as { standalone?: boolean }).standalone) {
    return 'ios'
  }
  return 'desktop'
}

export function InstallarClient() {
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())
  }, [])

  function handleDownload() {
    track('apk_download_clicked', { platform })
  }

  async function handleShare() {
    const url = 'https://mundial-pool.vercel.app/instalar'
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'mundial-pool',
          text: 'Bajá la app del Mundial 2026 entre amigos',
          url,
        })
        track('apk_share_clicked', { method: 'native' })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        toast.success('Link copiado')
        track('apk_share_clicked', { method: 'clipboard' })
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // user canceled o clipboard bloqueado, ignore
    }
  }

  if (platform === 'ios') {
    return (
      <Card className="mt-6 border-warning/30 bg-warning/5 p-5">
        <div className="flex items-start gap-3">
          <Apple className="h-5 w-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Estás en iPhone — no hay versión .apk</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Usá la web directo desde Safari:{' '}
              <a className="underline" href="/login">
                mundial-pool.vercel.app/login
              </a>
              . Para sentirla como app, en Safari tocá Compartir → "Añadir a inicio".
            </p>
          </div>
        </div>
      </Card>
    )
  }

  if (platform === 'desktop') {
    return (
      <Card className="mt-6 border-border p-5">
        <div className="flex items-start gap-3">
          <Globe className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Estás en computadora</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              El .apk es solo para Android. Usá la web:{' '}
              <a className="underline" href="/login">
                mundial-pool.vercel.app/login
              </a>
              . Para descargar para tu phone Android, abrí este link desde tu phone.
            </p>
            <Button size="sm" variant="ghost" className="mt-3" onClick={handleShare}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar link'}
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="mt-6 border-primary/30 bg-primary/5 p-5">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/15">
          <Smartphone className="h-7 w-7 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">Listo para Android</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            ~1 MB. Versión TWA firmada — la misma web pero como app nativa con notificaciones de
            primera.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button asChild size="lg" className="h-12 w-full sm:w-auto sm:flex-1">
          <a
            href="/downloads/mundial-pool.apk"
            download="mundial-pool.apk"
            onClick={handleDownload}
          >
            <Download className="h-5 w-5" />
            Descargar APK
          </a>
        </Button>
        <Button variant="secondary" size="lg" className="h-12 w-full sm:w-auto" onClick={handleShare}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copiado' : 'Compartir link'}
        </Button>
      </div>
    </Card>
  )
}
