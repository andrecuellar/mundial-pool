'use client'

import { Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { shareDomNodeAsImage } from '@/lib/share-dom'

type Props = {
  targetId: string
  fileName: string
  shareTitle: string
  shareText: string
  label?: string
  /** Apagar cuando hay más de un botón en la página, para que ?share=1 no dispare ambos. */
  autoShare?: boolean
}

export function ShareComprobanteButton({
  targetId,
  fileName,
  shareTitle,
  shareText,
  label = 'Compartir como imagen',
  autoShare = true,
}: Props) {
  const [pending, setPending] = useState(false)
  const autoTriggered = useRef(false)

  // Si la página viene con ?share=1 (caso típico: el user vino del flow de
  // guardado de predicciones y tocó "Compartir como imagen" en el overlay),
  // disparamos el share automáticamente al montar. Limpiamos el query
  // param para que un reload no lo dispare otra vez.
  useEffect(() => {
    if (!autoShare) return
    if (autoTriggered.current) return
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('share') !== '1') return
    autoTriggered.current = true
    const url = new URL(window.location.href)
    url.searchParams.delete('share')
    window.history.replaceState({}, '', url.toString())
    // Pequeño delay para que el DOM termine de hidratar el comprobante-card
    // antes de capturar.
    const t = window.setTimeout(() => {
      void handleShare()
    }, 350)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoShare])

  async function handleShare() {
    setPending(true)
    const result = await shareDomNodeAsImage({ targetId, fileName, shareTitle, shareText })
    setPending(false)
    if (result === 'not-found') toast.error('No se pudo encontrar el comprobante.')
    else if (result === 'error') toast.error('No se pudo generar la imagen.')
    else if (result === 'downloaded') toast.success('Imagen descargada')
  }

  return (
    <Button
      onClick={handleShare}
      disabled={pending}
      variant="default"
      size="lg"
      className="w-full"
      type="button"
    >
      <Share2 className="h-3.5 w-3.5" />
      {pending ? 'Generando imagen…' : label}
    </Button>
  )
}
