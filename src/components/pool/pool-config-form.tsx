'use client'

import { Check } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { updatePoolConfig } from '@/features/pool/actions'

type Props = {
  groupId: string
  initial: {
    enabled: boolean
    currency: string | null
    qrUrl: string | null
    payoutRule: 'winner_takes_all' | 'top_3_split' | 'manual'
  }
}

export function PoolConfigForm({ groupId, initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [currency, setCurrency] = useState(initial.currency ?? 'BOB')
  const [qrUrl, setQrUrl] = useState(initial.qrUrl ?? '')
  const [payoutRule, setPayoutRule] = useState(initial.payoutRule)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await updatePoolConfig({
        groupId,
        enabled,
        currency: enabled ? currency : null,
        qrUrl: qrUrl.trim() === '' ? null : qrUrl.trim(),
        payoutRule,
      })
      if (r.ok) toast.success('Configuración guardada')
      else toast.error(r.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Pozo monetario activo</p>
            <p className="text-xs text-muted-foreground">
              Visible para todos los miembros del grupo.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currency">Moneda</Label>
        <Select value={currency} onValueChange={setCurrency} disabled={!enabled}>
          <SelectTrigger id="currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BOB">BOB · Bolivianos</SelectItem>
            <SelectItem value="USD">USD · Dólares</SelectItem>
            <SelectItem value="EUR">EUR · Euros</SelectItem>
            <SelectItem value="PEN">PEN · Soles</SelectItem>
            <SelectItem value="ARS">ARS · Pesos argentinos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="qrUrl">URL del QR de depósito</Label>
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-1.5">
            <Input
              id="qrUrl"
              type="url"
              value={qrUrl}
              onChange={(e) => setQrUrl(e.target.value)}
              placeholder="https://..."
              disabled={!enabled}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              URL pública de la imagen (Yape, Tigo Money, transferencia). Cuando agreguemos Supabase
              Storage, esto será un uploader.
            </p>
          </div>
          {qrUrl && (
            // biome-ignore lint/performance/noImgElement: external QR preview
            <img
              src={qrUrl}
              alt="Preview QR"
              className="h-24 w-24 rounded-lg border border-border object-cover"
            />
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Regla de reparto</Label>
        <RadioGroup
          value={payoutRule}
          onValueChange={(v) => setPayoutRule(v as typeof payoutRule)}
          disabled={!enabled}
          className="gap-2"
        >
          {[
            {
              v: 'winner_takes_all',
              label: 'El ganador se lleva todo',
              sub: '100% al rank 1 al cierre del torneo.',
            },
            {
              v: 'top_3_split',
              label: 'Top 3 · 60 / 30 / 10',
              sub: '60% al rank 1, 30% al rank 2, 10% al rank 3.',
            },
            {
              v: 'manual',
              label: 'Reparto manual',
              sub: 'La app no calcula. Tú decides offline al final del Mundial.',
            },
          ].map((opt) => (
            <Label
              key={opt.v}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                payoutRule === opt.v
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:bg-muted/40'
              }`}
            >
              <RadioGroupItem value={opt.v} className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.sub}</div>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <Button type="submit" disabled={pending} size="lg" className="w-full">
        <Check className="h-4 w-4" />
        {pending ? 'Guardando…' : 'Guardar configuración'}
      </Button>
    </form>
  )
}
