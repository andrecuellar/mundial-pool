'use client'

import { Check, Share2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type Props = {
  code: string
  groupName: string
}

export function ShareButton({ code, groupName }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = `${window.location.origin}/join/${code}`
    // Bundle everything into `text` (with literal newlines) and skip the
    // separate `url` field so receiving apps render the message exactly as
    // composed — most clients otherwise concatenate text + url on one line.
    const text = `Te invito a unirte a "${groupName}" en mundial-pool.\n\nMi código es: ${code}\n\n${url}`
    const shareData = { title: 'mundial-pool', text }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData)
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Invitación copiada al portapapeles')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('No se pudo compartir. Copia el código manualmente.')
    }
  }

  return (
    <Button onClick={handleShare} variant="default" size="sm" type="button">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? 'Copiado' : 'Compartir'}
    </Button>
  )
}
