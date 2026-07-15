// Captura nodos del DOM como PNG y los entrega via Web Share API si el browser
// lo soporta, o los descarga como archivo. Diseñado para nodos visibles en
// pantalla; si el nodo está posicionado fuera del viewport (patrón "captureable
// pero oculto", ej. left:-20000px), lo trae temporalmente con z-index:-1 para
// evitar que el browser omita el paint del contenido.

import { buildZip } from '@/lib/zip'

type ShareArgs = {
  targetId: string
  fileName: string
  shareTitle: string
  shareText: string
}

export type MultiShareTarget = {
  targetId: string
  fileName: string
}

// 'blocked' = el Web Share API rechazó por falta de activación de usuario (la
// generación tomó más que la ventana del gesto). El caller puede reintentar el
// share desde un gesto fresco sin regenerar las imágenes.
type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'blocked' | 'not-found' | 'error'

function canShareFiles(files: File[]): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files })
  )
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revocar con delay: revocar de inmediato puede cancelar la descarga en algunos
  // browsers antes de que arranque.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// Los navegadores (Chrome) cortan las descargas automáticas en lote pasadas
// ~10 seguidas: con 12 archivos solo bajaban 10. Hasta este límite bajamos
// imágenes sueltas; por encima, un único .zip que no puede ser recortado.
export const MAX_BATCH_DOWNLOADS = 10

export async function downloadFiles(files: File[], albumName = 'mundial-pool-album') {
  if (files.length <= MAX_BATCH_DOWNLOADS) {
    for (const file of files) downloadFile(file)
    return
  }
  // Nombres únicos dentro del zip: dos miembros con el mismo nombre visible
  // generan el mismo fileName y una entrada pisaría a la otra al extraer.
  const used = new Set<string>()
  const names = files.map((f) => {
    let name = f.name
    for (let i = 2; used.has(name); i++) name = f.name.replace(/(\.[^.]+)?$/, `-${i}$1`)
    used.add(name)
    return name
  })
  const entries = await Promise.all(
    files.map(async (f, idx) => ({
      name: names[idx],
      data: new Uint8Array(await f.arrayBuffer()),
    })),
  )
  // .buffer (ArrayBuffer exacto, el Uint8Array es de tamaño justo) evita la
  // fricción de tipos entre Uint8Array<ArrayBufferLike> y BlobPart.
  const zipBuffer = buildZip(entries).buffer as ArrayBuffer
  downloadFile(new File([zipBuffer], `${albumName}.zip`, { type: 'application/zip' }))
}

// Captura un único nodo (por id) a un File PNG. Devuelve null si no existe el
// nodo o si la conversión falla. Maneja el caso "offscreen" (fixed + left/top
// muy negativos) trayéndolo al viewport durante la captura y restaurándolo.
async function captureNodeToFile(targetId: string, fileName: string): Promise<File | null> {
  const node = document.getElementById(targetId)
  if (!node) return null

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
    // Esperar a que las webfonts terminen de cargar. Si se captura con la fuente
    // de fallback (filas más bajas), html-to-image mide un alto corto y al
    // renderizar con la fuente real —filas más altas— la última fila se desborda
    // y `overflow-hidden` la recorta. Con tablas largas (48 selecciones) eso hace
    // desaparecer la fila #48.
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready
      } catch {
        // Font loading API no disponible/roto — seguimos igual.
      }
    }
    // html-to-image, sin alto/ancho explícitos, usa offsetWidth/Height =
    // round(tamaño). Con sub-píxeles ese redondeo puede quedar 1px por debajo del
    // contenido y recortar la última fila. Fijamos el border-box redondeado hacia
    // ARRIBA (ceil) para garantizar que el contenido completo entre en el canvas.
    const rect = node.getBoundingClientRect()
    const width = Math.ceil(rect.width)
    const height = Math.ceil(rect.height)
    // Filtra elementos marcados como `data-share-hide` (ej: botón "+" de agregar
    // reacción o el propio botón de compartir) — UI interactiva que no aporta a
    // la imagen.
    const dataUrl = await toPng(node, {
      pixelRatio: 2,
      width,
      height,
      backgroundColor: bg,
      cacheBust: true,
      filter: (n) => !(n instanceof Element) || !n.hasAttribute('data-share-hide'),
    })
    const blob = await fetch(dataUrl).then((r) => r.blob())
    return new File([blob], `${fileName}.png`, { type: 'image/png' })
  } catch (e) {
    console.error('captureNodeToFile failed', e)
    return null
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

// Genera un PNG por cada target, en orden, reportando progreso. Los targets que
// no se pueden capturar se omiten (no cortan el resto).
export async function captureNodesToFiles(
  targets: MultiShareTarget[],
  onProgress?: (done: number, total: number) => void,
): Promise<File[]> {
  const files: File[] = []
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]
    const file = await captureNodeToFile(t.targetId, t.fileName)
    if (file) files.push(file)
    onProgress?.(i + 1, targets.length)
  }
  return files
}

// Comparte una lista de archivos ya generados. Debe llamarse dentro (o muy cerca)
// de un gesto de usuario: si el Web Share API pide activación fresca devuelve
// 'blocked' sin descargar, para que el caller ofrezca reintentar con un tap.
export async function shareFiles(
  files: File[],
  meta: { shareTitle: string; shareText: string; albumFileName?: string },
): Promise<ShareResult> {
  if (files.length === 0) return 'error'
  if (canShareFiles(files)) {
    try {
      await navigator.share({ files, title: meta.shareTitle, text: meta.shareText })
      return 'shared'
    } catch (e) {
      const name = (e as Error).name
      if (name === 'AbortError') return 'cancelled'
      if (name === 'NotAllowedError') return 'blocked'
      // Otro error del share → caemos a descarga.
    }
  }
  await downloadFiles(files, meta.albumFileName)
  return 'downloaded'
}

export async function shareDomNodeAsImage(args: ShareArgs): Promise<ShareResult> {
  if (!document.getElementById(args.targetId)) return 'not-found'
  const file = await captureNodeToFile(args.targetId, args.fileName)
  if (!file) return 'error'

  const result = await shareFiles([file], {
    shareTitle: args.shareTitle,
    shareText: args.shareText,
  })
  // Captura simple: un bloqueo por activación es raro (la captura es rápida);
  // si ocurre, descargamos para no dejar al usuario sin nada.
  if (result === 'blocked') {
    downloadFile(file)
    return 'downloaded'
  }
  return result
}
