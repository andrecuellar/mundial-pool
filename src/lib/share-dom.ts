// Captura un nodo del DOM como PNG y lo entrega via Web Share API si el
// browser lo soporta, o lo descarga como archivo. Diseñado para nodos visibles
// en pantalla; si el nodo está posicionado fuera del viewport (patrón
// "captureable pero oculto", ej. left:-20000px), lo trae temporalmente con
// z-index:-1 para evitar que el browser omita el paint del contenido.

type ShareArgs = {
  targetId: string
  fileName: string
  shareTitle: string
  shareText: string
}

type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'not-found' | 'error'

export async function shareDomNodeAsImage(args: ShareArgs): Promise<ShareResult> {
  const node = document.getElementById(args.targetId)
  if (!node) return 'not-found'

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
    void node.offsetHeight
    await new Promise((r) => requestAnimationFrame(() => r(null)))
  }

  try {
    // Dynamic import so el bundle de html-to-image (~70KB) solo lo paga quien
    // realmente toca el botón.
    const { toPng } = await import('html-to-image')
    const bg = getComputedStyle(document.body).backgroundColor || '#0a0a0a'
    // Filtra elementos marcados como `data-share-hide` (ej: botón "+" de
    // agregar reacción) — son UI interactiva que no aporta nada en la imagen.
    const dataUrl = await toPng(node, {
      pixelRatio: 2,
      backgroundColor: bg,
      cacheBust: true,
      filter: (n) => !(n instanceof Element) || !n.hasAttribute('data-share-hide'),
    })
    const blob = await fetch(dataUrl).then((r) => r.blob())
    const file = new File([blob], `${args.fileName}.png`, { type: 'image/png' })

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], title: args.shareTitle, text: args.shareText })
        return 'shared'
      } catch (e) {
        if ((e as Error).name === 'AbortError') return 'cancelled'
        // fall through to download
      }
    }

    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${args.fileName}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    return 'downloaded'
  } catch (e) {
    console.error('shareDomNodeAsImage failed', e)
    return 'error'
  } finally {
    if (isOffscreen) {
      node.style.left = saved.left
      node.style.top = saved.top
      node.style.zIndex = saved.zIndex
      node.style.visibility = saved.visibility
      document.documentElement.style.overflowX = saved.docOverflowX
      document.body.style.overflowX = saved.bodyOverflowX
    }
  }
}
