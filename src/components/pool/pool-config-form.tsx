'use client'

import { Check } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
    payoutRule: 'winner_takes_all' | 'top_3_split' | 'manual'
  }
  /** Number of recorded deposits. Locks the currency picker when > 0. */
  transactionCount: number
}

export function PoolConfigForm({ groupId, initial, transactionCount }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [currency, setCurrency] = useState(initial.currency ?? 'BOB')
  const [payoutRule, setPayoutRule] = useState(initial.payoutRule)
  const [pending, startTransition] = useTransition()
  const currencyLocked = transactionCount > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await updatePoolConfig({
        groupId,
        enabled,
        currency: enabled ? currency : null,
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
        <Select value={currency} onValueChange={setCurrency} disabled={!enabled || currencyLocked}>
          <SelectTrigger id="currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BOB">BOB · Bolivianos</SelectItem>
            <SelectItem value="USDT">USDT · Tether</SelectItem>
          </SelectContent>
        </Select>
        {currencyLocked && (
          <p className="text-xs text-muted-foreground">
            🔒 La moneda queda fija después del primer depósito. Para cambiarla, primero elimina los{' '}
            {transactionCount} {transactionCount === 1 ? 'depósito' : 'depósitos'} registrados.
          </p>
        )}
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
