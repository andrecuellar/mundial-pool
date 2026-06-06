'use client'

import { AlertTriangle, Megaphone, Send } from 'lucide-react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SavingOverlay } from '@/components/app-shell/saving-overlay'
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
import { Card } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
import type { AudienceFilter } from '@/features/notifications/audience'
import { previewAudience, sendAdminBroadcast } from '@/features/notifications/broadcast'

type GroupOption = { id: string; name: string; poolEnabled: boolean }

type Props = {
  groups: GroupOption[]
}

type AudienceKind = AudienceFilter['kind']

const AUDIENCE_OPTIONS: { value: AudienceKind; label: string; description: string }[] = [
  {
    value: 'all',
    label: 'Todos los usuarios',
    description: 'A todos los que tienen cuenta (excepto baneados).',
  },
  {
    value: 'group',
    label: 'Miembros de un grupo',
    description: 'A todos los inscritos en un grupo específico.',
  },
  {
    value: 'non_payers',
    label: 'Pendientes de pago',
    description: 'Miembros de un grupo (o de cualquier grupo con pozo) que aún no aportaron.',
  },
  {
    value: 'non_predictors',
    label: 'Pendientes de predicción',
    description: 'Miembros con menos de N predicciones en un grupo (o globalmente).',
  },
  {
    value: 'non_payers_and_non_predictors',
    label: 'No pagaron Y no predijeron',
    description: 'Los más desconectados: ni un pago ni predicciones completas.',
  },
]

const TEMPLATES: Record<string, { title: string; body: string }> = {
  custom: { title: '', body: '' },
  payment_reminder: {
    title: '💰 No olvides aportar al pozo',
    body: 'Quedan pocos días para el cierre. Avísale al admin cuando hayas mandado tu aporte.',
  },
  predictions_reminder: {
    title: '🎯 Te faltan predicciones',
    body: 'Entra y completa tus 14 picks antes de que cierre. Toma 5 minutos.',
  },
  announcement: {
    title: '📣 Anuncio',
    body: '',
  },
}

export function NotificarForm({ groups }: Props) {
  const [audienceKind, setAudienceKind] = useState<AudienceKind>('non_payers')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [threshold, setThreshold] = useState<number>(0)
  const [template, setTemplate] = useState<string>('payment_reminder')
  const [title, setTitle] = useState<string>(TEMPLATES.payment_reminder.title)
  const [body, setBody] = useState<string>(TEMPLATES.payment_reminder.body)
  const [url, setUrl] = useState<string>('')
  const [ignoreOptOut, setIgnoreOptOut] = useState(false)

  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [phase, setPhase] = useState<'idle' | 'saving' | 'success'>('idle')

  const poolGroups = useMemo(() => groups.filter((g) => g.poolEnabled), [groups])

  // Para el selector de grupo: si la audiencia es 'group', necesita un grupo
  // específico. Si es non_payers/non_predictors/combined, también puede ser
  // null (= "cualquiera de los grupos compatibles").
  const requiresGroup = audienceKind === 'group'
  const groupSelectorVisible = audienceKind !== 'all'
  const groupListForKind = audienceKind === 'non_payers' ? poolGroups : groups
  const allowGroupNull = audienceKind !== 'group'

  const filter: AudienceFilter | null = useMemo(() => {
    if (audienceKind === 'all') return { kind: 'all' }
    if (audienceKind === 'group') return groupId ? { kind: 'group', groupId } : null
    if (audienceKind === 'non_payers') return { kind: 'non_payers', groupId }
    if (audienceKind === 'non_predictors')
      return { kind: 'non_predictors', groupId, threshold }
    return { kind: 'non_payers_and_non_predictors', groupId }
  }, [audienceKind, groupId, threshold])

  // Debounced preview de la audiencia. Reseteamos a null mientras preview-amos
  // para que el UI no muestre un count viejo.
  useEffect(() => {
    if (!filter) {
      setAudienceCount(null)
      return
    }
    setPreviewing(true)
    const handle = setTimeout(async () => {
      const r = await previewAudience(filter)
      if (r.ok) setAudienceCount(r.count)
      else setAudienceCount(null)
      setPreviewing(false)
    }, 400)
    return () => clearTimeout(handle)
  }, [filter])

  function handleTemplateChange(next: string) {
    setTemplate(next)
    const t = TEMPLATES[next]
    if (t) {
      setTitle(t.title)
      setBody(t.body)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!filter) {
      toast.error('Elige un grupo.')
      return
    }
    if (title.trim() === '' || body.trim() === '') {
      toast.error('Título y cuerpo son obligatorios.')
      return
    }
    setConfirmOpen(true)
  }

  function confirmSend() {
    if (!filter) return
    setConfirmOpen(false)
    setPhase('saving')
    startTransition(async () => {
      const r = await sendAdminBroadcast({
        title: title.trim(),
        body: body.trim(),
        url: url.trim() === '' ? null : url.trim(),
        audienceFilter: filter,
        ignoreOptOut,
      })
      if (r.ok) {
        setPhase('success')
        setTimeout(() => {
          toast.success(`Enviado a ${r.audienceCount} usuarios`)
          setPhase('idle')
        }, 800)
      } else {
        setPhase('idle')
        toast.error(r.error)
      }
    })
  }

  return (
    <>
      <SavingOverlay
        phase={phase}
        icon={Megaphone}
        savingTitle="Enviando notificación"
        savingSubtitle="Disparando push a los usuarios"
        successTitle="¡Enviada!"
        successSubtitle="Las suscripciones procesan el push en background"
      />

      <Card className="p-5 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Audiencia */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Audiencia</h2>
              <p className="text-xs text-muted-foreground">A quién le va a llegar este push.</p>
            </div>
            <RadioGroup
              value={audienceKind}
              onValueChange={(v) => {
                setAudienceKind(v as AudienceKind)
                if (v === 'group') setGroupId(null)
              }}
              className="grid gap-2 sm:grid-cols-2"
            >
              {AUDIENCE_OPTIONS.map((opt) => (
                <Label
                  key={opt.value}
                  htmlFor={`aud-${opt.value}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    audienceKind === opt.value
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <RadioGroupItem value={opt.value} id={`aud-${opt.value}`} className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{opt.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                </Label>
              ))}
            </RadioGroup>

            {groupSelectorVisible && (
              <div className="space-y-1.5">
                <Label htmlFor="group-select" className="text-xs">
                  {requiresGroup ? 'Grupo' : 'Grupo (opcional)'}
                </Label>
                <Select
                  value={groupId ?? 'any'}
                  onValueChange={(v) => setGroupId(v === 'any' ? null : v)}
                >
                  <SelectTrigger id="group-select">
                    <SelectValue placeholder="Elige un grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowGroupNull && (
                      <SelectItem value="any">
                        Cualquier grupo {audienceKind === 'non_payers' ? 'con pozo' : 'activo'}
                      </SelectItem>
                    )}
                    {groupListForKind.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {audienceKind === 'non_predictors' && (
              <div className="space-y-1.5">
                <Label htmlFor="threshold" className="text-xs">
                  Umbral: predicciones hechas ≤
                </Label>
                <Input
                  id="threshold"
                  type="number"
                  min={0}
                  max={14}
                  value={threshold}
                  onChange={(e) =>
                    setThreshold(Math.min(14, Math.max(0, Number(e.target.value) || 0)))
                  }
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">
                  0 = solo los que no hicieron ninguna. 13 = todos los que no completaron las 14.
                </p>
              </div>
            )}

            <div
              className={`rounded-lg border p-3 text-xs ${
                previewing
                  ? 'border-border bg-muted/30 text-muted-foreground'
                  : (audienceCount ?? 0) > 0
                    ? 'border-accent/40 bg-accent/5 text-foreground'
                    : 'border-border bg-muted/30 text-muted-foreground'
              }`}
            >
              {previewing ? (
                <span>Contando audiencia…</span>
              ) : audienceCount === null ? (
                <span>Elige los filtros para ver a cuántos llega.</span>
              ) : (
                <span>
                  Va a llegar a{' '}
                  <span className="font-mono font-semibold tabular-nums">{audienceCount}</span>{' '}
                  {audienceCount === 1 ? 'usuario' : 'usuarios'}.{' '}
                  {audienceCount > 0 && (
                    <span className="text-muted-foreground">
                      (entre los que tienen push activo en su dispositivo)
                    </span>
                  )}
                </span>
              )}
            </div>
          </section>

          {/* Mensaje */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Mensaje</h2>
              <p className="text-xs text-muted-foreground">
                Elige un template como punto de partida o escribe tu propio mensaje.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template" className="text-xs">
                Template
              </Label>
              <Select value={template} onValueChange={handleTemplateChange}>
                <SelectTrigger id="template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom (vacío)</SelectItem>
                  <SelectItem value="payment_reminder">Recordatorio de pago</SelectItem>
                  <SelectItem value="predictions_reminder">Recordatorio de predicciones</SelectItem>
                  <SelectItem value="announcement">Anuncio general</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs">
                Título <span className="text-muted-foreground">({title.length}/60)</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 60))}
                maxLength={60}
                placeholder="Algo corto y claro"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body" className="text-xs">
                Cuerpo <span className="text-muted-foreground">({body.length}/200)</span>
              </Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 200))}
                maxLength={200}
                rows={3}
                placeholder="El mensaje principal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url" className="text-xs">
                URL al tocar el push (opcional)
              </Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/groups/mi-grupo o /"
              />
            </div>
          </section>

          {/* Critical toggle */}
          <section className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/[0.03] p-3">
            <div className="flex items-start gap-3">
              <Switch
                id="critical"
                checked={ignoreOptOut}
                onCheckedChange={setIgnoreOptOut}
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label htmlFor="critical" className="text-sm font-medium leading-tight">
                  Mensaje crítico (ignora opt-outs)
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Si está activo, manda el push incluso a usuarios que apagaron "Mensajes del
                  administrador" en sus preferencias. Solo para avisos importantes — si abusas, la
                  gente bloquea el push del navegador y los pierdes para siempre.
                </p>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !filter || audienceCount === 0} size="lg">
              <Send className="h-4 w-4" />
              Enviar
            </Button>
          </div>
        </form>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar la notificación?</AlertDialogTitle>
            <AlertDialogDescription>
              Va a llegar a {audienceCount ?? '?'}{' '}
              {audienceCount === 1 ? 'usuario' : 'usuarios'}. Esto no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <p className="text-sm font-medium leading-tight">{title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
          </div>
          {ignoreOptOut && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span className="text-muted-foreground">
                Marcaste el mensaje como{' '}
                <span className="font-medium text-destructive">crítico</span> — va a llegar incluso
                a usuarios que apagaron este tipo de aviso. Confirma que es importante.
              </span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend} disabled={pending}>
              {pending ? 'Enviando…' : 'Sí, enviar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
