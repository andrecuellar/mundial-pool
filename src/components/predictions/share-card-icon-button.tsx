'use client'

import { Share2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { shareDomNodeAsImage } from '@/lib/share-dom'

type Props = {
  targetId: string
  fileName: string
  shareTitle: string
  shareText: string
  ariaLabel: string
}

// Versión compacta del share-as-image para usar en un header de card.
// Comparte la misma lógica que `ShareComprobanteButton` via `shareDomNodeAsImage`,
// pero sin auto-trigger por ?share=1 y con estilo discreto.
export function ShareCardIconButton({
  targetId,
  fileName,
  shareTitle,
  shareText,
  ariaLabel,
}: Props) {
  const [pending, setPending] = useState(false)

  async function handleShare() {
    setPending(true)
    const result = await shareDomNodeAsImage({ targetId, fileName, shareTitle, shareText })
    setPending(false)
    if (result === 'not-found') toast.error('No se pudo encontrar la tarjeta.')
    else if (result === 'error') toast.error('No se pudo generar la imagen.')
    else if (result === 'downloaded') toast.success('Imagen descargada')
  }

  return (
    <Button
      onClick={handleShare}
      disabled={pending}
      variant="outline"
      size="sm"
      type="button"
      aria-label={ariaLabel}
      className="shrink-0 text-muted-foreground hover:text-foreground"
    >
      <Share2 className={`h-4 w-4 ${pending ? 'animate-pulse' : ''}`} />
      <span>Compartir</span>
    </Button>
  )
}
