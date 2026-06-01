'use client'

import { ArrowRight } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
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
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    if (poolEnabled) formData.set('poolEnabled', 'on')
    const lockRaw = formData.get('predictionsLockAt')
    if (typeof lockRaw === 'string' && lockRaw.length > 0) {
      const d = new Date(lockRaw)
      if (!Number.isNaN(d.getTime())) {
        formData.set('predictionsLockAt', d.toISOString())
      }
    }
    startTransition(async () => {
      const result = await createGroup(formData)
      if (result.ok) {
        toast.success('Grupo creado')
        window.location.href = `/groups/${result.data.slug}`
      } else toast.error(result.error)
    })
  }

  return (
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
              La app no procesa pagos — solo lleva el ledger entre ustedes.
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
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Todos los miembros aportan el mismo monto. El QR de depósito se sube después desde{' '}
              <span className="font-medium text-foreground">Configurar pozo</span> en el grupo.
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
  )
}
