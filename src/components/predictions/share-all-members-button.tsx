'use client'

import { Images } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  captureNodesToFiles,
  downloadFiles,
  MAX_BATCH_DOWNLOADS,
  type MultiShareTarget,
  shareFiles,
} from '@/lib/share-dom'

type Props = {
  targets: MultiShareTarget[]
  shareTitle: string
  shareText: string
  ariaLabel: string
  /** Nombre base del .zip cuando la descarga cae en lote (sin extensión). */
  albumFileName: string
}

// Comparte las apuestas de TODOS los miembros en una sola acción.
//
// Hasta MAX_BATCH_DOWNLOADS participantes: genera un PNG por miembro y los
// entrega juntos al Web Share API (WhatsApp/Telegram los agrupan como álbum) o,
// si no hay share, los descarga como imágenes sueltas. Como generar varias
// imágenes puede tardar más que la ventana del gesto, si el share queda
// bloqueado conservamos las imágenes y pedimos un segundo tap.
//
// Por encima de ese límite, Chrome corta las descargas/compartidos en lote
// (bajaban solo 10 de 12), así que avisamos con un modal y entregamos todo en
// un único .zip (una imagen por persona adentro).
export function ShareAllMembersButton({
  targets,
  shareTitle,
  shareText,
  ariaLabel,
  albumFileName,
}: Props) {
  const [phase, setPhase] = useState<'idle' | 'confirm-zip' | 'generating' | 'ready'>('idle')
  const [progress, setProgress] = useState(0)
  const [readyFiles, setReadyFiles] = useState<File[]>([])
  const useZip = targets.length > MAX_BATCH_DOWNLOADS

  async function finishShare(files: File[], allowRetry: boolean) {
    const result = await shareFiles(files, { shareTitle, shareText, albumFileName })
    if (result === 'blocked') {
      if (allowRetry) {
        // La generación consumió el gesto: guardamos las imágenes y pedimos otro tap.
        setReadyFiles(files)
        setPhase('ready')
        toast.success('Imágenes listas — toca para compartir el álbum')
      } else {
        // Segundo intento también bloqueado: descargamos para no dejar al usuario atascado.
        await downloadFiles(files, albumFileName)
        setReadyFiles([])
        setPhase('idle')
        toast.success(`${files.length} imágenes descargadas`)
      }
      return
    }
    setReadyFiles([])
    setPhase('idle')
    if (result === 'error') toast.error('No se pudieron generar las imágenes.')
    else if (result === 'downloaded') toast.success(`${files.length} imágenes descargadas`)
  }

  async function generate(): Promise<File[] | null> {
    setPhase('generating')
    setProgress(0)
    const files = await captureNodesToFiles(targets, (done) => setProgress(done))
    if (files.length === 0) {
      setPhase('idle')
      toast.error('No se pudieron generar las imágenes.')
      return null
    }
    return files
  }

  async function handleShareImages() {
    if (targets.length === 0) return
    const files = await generate()
    if (files) await finishShare(files, true)
  }

  async function handleDownloadZip() {
    const files = await generate()
    if (!files) return
    await downloadFiles(files, albumFileName)
    setPhase('idle')
    toast.success('Álbum descargado')
  }

  function handleClick() {
    if (targets.length === 0) return
    if (useZip) setPhase('confirm-zip')
    else void handleShareImages()
  }

  if (phase === 'ready') {
    return (
      <Button
        onClick={() => finishShare(readyFiles, false)}
        variant="default"
        size="sm"
        type="button"
        aria-label={ariaLabel}
        className="shrink-0"
      >
        <Images className="h-4 w-4" />
        <span>Compartir álbum ({readyFiles.length})</span>
      </Button>
    )
  }

  const generating = phase === 'generating'
  return (
    <>
      <Button
        onClick={handleClick}
        disabled={generating}
        variant="outline"
        size="sm"
        type="button"
        aria-label={ariaLabel}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <Images className={`h-4 w-4 ${generating ? 'animate-pulse' : ''}`} />
        <span>{generating ? `Generando ${progress}/${targets.length}…` : 'Compartir todas'}</span>
      </Button>

      <AlertDialog
        open={phase === 'confirm-zip'}
        onOpenChange={(open) => {
          if (!open) setPhase((p) => (p === 'confirm-zip' ? 'idle' : p))
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Se descargará un archivo .zip</AlertDialogTitle>
            <AlertDialogDescription>
              Son {targets.length} participantes y Chrome no permite compartir ni descargar más de{' '}
              {MAX_BATCH_DOWNLOADS} imágenes a la vez. Para no perder ninguna, las apuestas de todos
              se descargan juntas en un archivo <span className="font-medium">.zip</span> — ábrelo y
              vas a encontrar una imagen por persona.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDownloadZip()}>
              Descargar .zip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
