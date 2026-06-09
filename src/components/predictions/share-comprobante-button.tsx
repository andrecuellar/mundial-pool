'use client'

import { Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type Props = {
  targetId: string
  fileName: string
  shareTitle: string
  shareText: string
}

export function ShareComprobanteButton({ targetId, fileName, shareTitle, shareText }: Props) {
  const [pending, setPending] = useState(false)
  const autoTriggered = useRef(false)

  // Si la página viene con ?share=1 (caso típico: el user vino del flow de
  // guardado de predicciones y tocó "Compartir como imagen" en el overlay),
  // disparamos el share automáticamente al montar. Limpiamos el query
  // param para que un reload no lo dispare otra vez.
  useEffect(() => {
    if (autoTriggered.current) return
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('share') !== '1') return
    autoTriggered.current = true
    // Limpiar el query param sin recargar.
    const url = new URL(window.location.href)
    url.searchParams.delete('share')
    window.history.replaceState({}, '', url.toString())
    // Pequeño delay para que el DOM termine de hidratar el comprobante-card
    // antes de capturar — sino html-to-image puede capturar mid-render.
    const t = window.setTimeout(() => {
      void handleShare()
    }, 350)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleShare() {
    const node = document.getElementById(targetId)
    if (!node) {
      toast.error('No se pudo encontrar el comprobante.')
      return
    }
    setPending(true)
    // Si el target está posicionado lejos del viewport (patrón "captureable
    // pero oculto", ej. faq-share-card a left:-20000px), los browsers pueden
    // saltarse el paint del contenido como optimización y html-to-image
    // devuelve PNG vacío. Lo traemos al viewport con z-index:-1 (atrás del
    // body bg, invisible al user) sólo durante la captura.
    const cs = window.getComputedStyle(node)
    const isOffscreen =
      cs.position === 'fixed' &&
      (parseFloat(cs.left || '0') < -2000 || parseFloat(cs.top || '0') < -2000)
    const saved = {
      left: node.style.left,
      top: node.style.top,
      zIndex: node.style.zIndex,
      visibility: node.style.visibility,
      docOverflowX: document.documentElement.style.overflowX,
      bodyOverflowX: document.body.style.overflowX,
    }
    if (isOffscreen) {
      node.style.left = '0px'
      node.style.top = '0px'
      node.style.zIndex = '-1'
      document.documentElement.style.overflowX = 'hidden'
      document.body.style.overflowX = 'hidden'
      // Forzar layout/paint antes de capturar.
      void node.offsetHeight
      await new Promise((r) => requestAnimationFrame(() => r(null)))
    }
    try {
      // Dynamic import so the ~70KB html-to-image bundle is only paid by users
      // who actually click "Compartir". Capture follows whatever theme the
      // user has active, since it renders the live DOM.
      const { toPng } = await import('html-to-image')
      const bg = getComputedStyle(document.body).backgroundColor || '#0a0a0a'
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: bg,
        cacheBust: true,
      })
      const blob = await fetch(dataUrl).then((r) => r.blob())
      const file = new File([blob], `${fileName}.png`, { type: 'image/png' })

      // Mobile: try native Web Share with files. iOS 15+ and modern Android
      // Chrome support this. Falls back to download otherwise.
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: shareTitle,
            text: shareText,
          })
          return
        } catch (e) {
          if ((e as Error).name === 'AbortError') return
          // fall through to download
        }
      }

      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${fileName}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      toast.success('Imagen descargada')
    } catch (e) {
      console.error('share comprobante failed', e)
      toast.error('No se pudo generar la imagen.')
    } finally {
      if (isOffscreen) {
        node.style.left = saved.left
        node.style.top = saved.top
        node.style.zIndex = saved.zIndex
        node.style.visibility = saved.visibility
        document.documentElement.style.overflowX = saved.docOverflowX
        document.body.style.overflowX = saved.bodyOverflowX
      }
      setPending(false)
    }
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
      {pending ? 'Generando imagen…' : 'Compartir como imagen'}
    </Button>
  )
}
