'use client'

import { ArrowRight, ImagePlus, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SavingOverlay } from '@/components/app-shell/saving-overlay'
import { PoolDisclaimer } from '@/components/legal/pool-disclaimer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { createGroup } from '@/features/groups/actions'

export function NewGroupForm() {
  const [poolEnabled, setPoolEnabled] = useState(false)
  const [qrFile, setQrFile] = useState<File | null>(null)
  const [qrPreview, setQrPreview] = useState<string | null>(null)
  const [savePhase, setSavePhase] = useState<'idle' | 'saving' | 'success'>('idle')
  const [pending, startTransition] = useTransition()
  const qrInputRef = useRef<HTMLInputElement>(null)

  // Free the object URL when the preview changes or the component unmounts so
  // we don't leak blob URLs across re-renders.
  useEffect(() => {
    if (!qrFile) {
      setQrPreview(null)
      return
    }
    const url = URL.createObjectURL(qrFile)
    setQrPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [qrFile])

  function handleQrSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen.')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Máximo 5 MB.')
      return
    }
    setQrFile(f)
  }

  function clearQr() {
    setQrFile(null)
    if (qrInputRef.current) qrInputRef.current.value = ''
  }

  function handleSubmit(formData: FormData) {
    if (poolEnabled) formData.set('poolEnabled', 'on')
    const lockRaw = formData.get('predictionsLockAt')
    if (typeof lockRaw === 'string' && lockRaw.length > 0) {
      const d = new Date(lockRaw)
      if (!Number.isNaN(d.getTime())) {
        formData.set('predictionsLockAt', d.toISOString())
      }
    }
    // The hidden <input type="file"> is only mounted when the pool is on, so
    // the server already gets `poolQr` correctly. Strip if the user toggled
    // off after picking a file.
    if (!poolEnabled) formData.delete('poolQr')
    setSavePhase('saving')
    startTransition(async () => {
      const result = await createGroup(formData)
      if (result.ok) {
        toast.success('Grupo creado')
        setSavePhase('success')
        setTimeout(() => {
          window.location.href = `/groups/${result.data.slug}`
        }, 900)
      } else {
        setSavePhase('idle')
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      <SavingOverlay
        phase={savePhase}
        icon={Sparkles}
        savingTitle="Creando tu grupo"
        savingSubtitle="Configurando categorías, código de invitación y pozo"
        successSubtitle="Llevándote al grupo"
      />

      <form action={handleSubmit} className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre del grupo</Label>
          <Input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={60}
            placeholder="Ej: Mundialistas BO"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">Lo verán todos los miembros del grupo.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="predictionsLockAt">Bloquear predicciones a partir de</Label>
          <Input
            id="predictionsLockAt"
            name="predictionsLockAt"
            type="datetime-local"
            required
            defaultValue="2026-06-11T17:00"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Después de esa fecha nadie podrá editar predicciones.{' '}
            <span className="font-medium text-primary">
              Sugerido: partido inaugural (México vs Sudáfrica).
            </span>
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Activar pozo monetario (opt-in)</p>
              <p className="text-xs text-muted-foreground">
                La app no procesa pagos — solo lleva el registro entre ustedes.
              </p>
            </div>
            <Switch checked={poolEnabled} onCheckedChange={setPoolEnabled} />
          </div>

          {poolEnabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <PoolDisclaimer variant="form" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="poolCurrency" className="text-xs">
                  Moneda
                </Label>
                <Select name="poolCurrency" defaultValue="BOB">
                  <SelectTrigger id="poolCurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOB">BOB · Bolivianos</SelectItem>
                    <SelectItem value="USDT">USDT · Tether</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="poolBuyInAmount" className="text-xs">
                  Aporte por jugador
                </Label>
                <Input
                  id="poolBuyInAmount"
                  name="poolBuyInAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue="100"
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="poolPayoutRule" className="text-xs">
                  Regla de reparto
                </Label>
                <Select name="poolPayoutRule" defaultValue="winner_takes_all">
                  <SelectTrigger id="poolPayoutRule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="winner_takes_all">Ganador se lleva todo</SelectItem>
                    <SelectItem value="top_3_split">Top 3 · 60 / 30 / 10</SelectItem>
                    <SelectItem value="manual">Reparto manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="poolQr" className="text-xs">
                  QR de depósito (opcional, lo puedes subir ahora)
                </Label>
                <input
                  ref={qrInputRef}
                  id="poolQr"
                  name="poolQr"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleQrSelect}
                  className="hidden"
                />
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex flex-1 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => qrInputRef.current?.click()}
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      {qrFile ? 'Reemplazar imagen' : 'Subir imagen'}
                    </Button>
                    {qrFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={clearQr}
                      >
                        <X className="h-3.5 w-3.5" />
                        Quitar
                      </Button>
                    )}
                  </div>
                  {qrPreview && (
                    // biome-ignore lint/performance/noImgElement: local blob preview
                    <img
                      src={qrPreview}
                      alt="Vista previa del QR"
                      className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover"
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG o WEBP, máximo 5 MB. Si lo dejas vacío, lo puedes subir después desde
                  Configurar pozo en el grupo.
                </p>
              </div>

              <p className="text-xs text-muted-foreground sm:col-span-2">
                Todos los miembros aportan el mismo monto.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" size="lg" asChild className="flex-1">
            <a href="/">Cancelar</a>
          </Button>
          <Button type="submit" disabled={pending} size="lg" className="flex-[2]">
            {pending ? 'Creando…' : 'Crear grupo'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </>
  )
}
