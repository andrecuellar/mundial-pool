'use client'

import { Trash2, Upload } from 'lucide-react'
import { useRef, useState, useTransition } from 'react'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { removePoolQr, uploadPoolQr } from '@/features/pool/storage'

type Props = {
  groupId: string
  initialUrl: string | null
}

export function QrUploadCard({ groupId, initialUrl }: Props) {
  const [url, setUrl] = useState(initialUrl)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const fd = new FormData()
    fd.set('groupId', groupId)
    fd.set('file', file)
    startTransition(async () => {
      const r = await uploadPoolQr(fd)
      if (r.ok) {
        setUrl(r.url)
        toast.success('QR actualizado')
      } else toast.error(r.error)
    })
  }

  function handleRemove() {
    startTransition(async () => {
      const r = await removePoolQr(groupId)
      if (r.ok) {
        setUrl(null)
        toast.success('QR eliminado')
        if (inputRef.current) inputRef.current.value = ''
      } else toast.error(r.error)
    })
  }

  return (
    <div className="space-y-3">
      <Label>QR de depósito</Label>
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {url ? 'Reemplazar imagen' : 'Subir imagen'}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            {url && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar QR</AlertDialogTitle>
                    <AlertDialogDescription>
                      Los miembros del grupo dejarán de ver el QR para aportar al pozo. Puedes subir
                      uno nuevo después.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRemove}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPG o WEBP, máx 5 MB. Sube tu QR de Yape, Tigo Money o transferencia. Los miembros
            lo verán al abrir el dashboard del grupo.
          </p>
        </div>
        {url && (
          // biome-ignore lint/performance/noImgElement: cross-origin Supabase Storage
          <img
            src={url}
            alt="QR actual"
            className="h-24 w-24 rounded-lg border border-border object-cover"
          />
        )}
      </div>
    </div>
  )
}
