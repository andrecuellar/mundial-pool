'use client'

import { Plus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
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
import { recordPoolTransaction } from '@/features/pool/actions'
import { formatMoney } from '@/lib/format'

type Member = { userId: string; displayName: string }

type Props = {
  groupId: string
  currency: string
  buyInAmount: number
  members: Member[]
}

const ANON_VALUE = '__anon__'

export function DepositForm({ groupId, currency, buyInAmount, members }: Props) {
  const [contributor, setContributor] = useState<string>(members[0]?.userId ?? ANON_VALUE)
  const [anonLabel, setAnonLabel] = useState('')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await recordPoolTransaction({
        groupId,
        contributorUserId: contributor === ANON_VALUE ? null : contributor,
        contributorLabel: contributor === ANON_VALUE ? anonLabel || 'Anónimo' : null,
        note: note.trim() === '' ? null : note.trim(),
      })
      if (r.ok) {
        toast.success('Depósito registrado')
        setNote('')
        setAnonLabel('')
      } else toast.error(r.error)
    })
  }

  const isAnon = contributor === ANON_VALUE

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Monto por jugador
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
          {formatMoney(buyInAmount, currency)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Fijo para todos. Edítalo en la configuración del pozo.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contributor">Contribuyente</Label>
        <Select value={contributor} onValueChange={setContributor}>
          <SelectTrigger id="contributor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.displayName}
              </SelectItem>
            ))}
            <SelectItem value={ANON_VALUE}>Otro / anónimo</SelectItem>
          </SelectContent>
        </Select>
        {isAnon && (
          <Input
            value={anonLabel}
            onChange={(e) => setAnonLabel(e.target.value)}
            placeholder="Nombre o etiqueta (ej: amigo de Pedro)"
            maxLength={60}
          />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="note">Nota</Label>
          <span className="text-xs text-muted-foreground">opcional</span>
        </div>
        <Input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Yape · 12 jun"
          maxLength={280}
        />
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        El pago se hace fuera de la app. Tú confirmas la recepción y registras el depósito acá.
      </div>

      <Button type="submit" disabled={pending} size="lg" className="w-full">
        <Plus className="h-4 w-4" />
        {pending ? 'Registrando…' : 'Registrar depósito'}
      </Button>
    </form>
  )
}
