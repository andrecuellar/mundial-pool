'use client'

import { Images } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  captureNodesToFiles,
  downloadFiles,
  type MultiShareTarget,
  shareFiles,
} from '@/lib/share-dom'

type Props = {
  targets: MultiShareTarget[]
  shareTitle: string
  shareText: string
  ariaLabel: string
}

// Comparte las apuestas de TODOS los miembros como un álbum de imágenes (un PNG
// por miembro) en una sola acción, sin tocar "Compartir" uno por uno.
//
// Genera todas las imágenes y luego las entrega juntas al Web Share API
// (navigator.share soporta múltiples archivos → WhatsApp/Telegram las agrupan
// como álbum). Como generar varias imágenes puede tardar más que la ventana del
// gesto de usuario, si el share queda bloqueado por activación conservamos las
// imágenes ya generadas y pedimos un segundo tap que las comparte al instante.
export function ShareAllMembersButton({ targets, shareTitle, shareText, ariaLabel }: Props) {
  const [phase, setPhase] = useState<'idle' | 'generating' | 'ready'>('idle')
  const [progress, setProgress] = useState(0)
  const [readyFiles, setReadyFiles] = useState<File[]>([])

  async function finishShare(files: File[], allowRetry: boolean) {
    const result = await shareFiles(files, { shareTitle, shareText })
    if (result === 'blocked') {
      if (allowRetry) {
        // La generación consumió el gesto: guardamos las imágenes y pedimos otro tap.
        setReadyFiles(files)
        setPhase('ready')
        toast.success('Imágenes listas — toca para compartir el álbum')
      } else {
        // Segundo intento también bloqueado: descargamos para no dejar al usuario atascado.
        downloadFiles(files)
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

  async function handleGenerate() {
    if (targets.length === 0) return
    setPhase('generating')
    setProgress(0)
    const files = await captureNodesToFiles(targets, (done) => setProgress(done))
    if (files.length === 0) {
      setPhase('idle')
      toast.error('No se pudieron generar las imágenes.')
      return
    }
    await finishShare(files, true)
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
    <Button
      onClick={handleGenerate}
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
  )
}
