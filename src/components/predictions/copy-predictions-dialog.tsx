'use client'

import { ArrowRight, CheckCircle2, ChevronRight, Copy, Lock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
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
import { SavingOverlay } from '@/components/app-shell/saving-overlay'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { copyPredictions } from '@/features/predictions/copy'

export type CopyDialogGroup = {
  id: string
  name: string
  slug: string
  locked: boolean
  predictionsCount: number
}

type Props = {
  trigger: React.ReactNode
  myGroups: CopyDialogGroup[]
  /** When opened from inside a group's predict page, pre-tick that group as dest. */
  defaultDestGroupIds?: string[]
  /** When opened from inside a group's predict page, lock the dest selection. */
  lockDestSelection?: boolean
}

type CopiedRow = {
  groupId: string
  groupName: string
  slug: string
  count: number
}

export function CopyPredictionsDialog({
  trigger,
  myGroups,
  defaultDestGroupIds,
  lockDestSelection = false,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sourceGroupId, setSourceGroupId] = useState<string>('')
  const [destGroupIds, setDestGroupIds] = useState<Set<string>>(
    () => new Set(defaultDestGroupIds ?? []),
  )
  const [pending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [conflicts, setConflicts] = useState<
    { groupId: string; groupName: string; count: number }[]
  >([])
  // 'form' = pick source + dests; 'result' = post-copy receipt with links.
  const [view, setView] = useState<'form' | 'result'>('form')
  // Full-screen SavingOverlay phase. Driven by handleSubmit.
  const [phase, setPhase] = useState<'idle' | 'saving' | 'success'>('idle')
  const [copiedResult, setCopiedResult] = useState<CopiedRow[]>([])

  // Available sources: groups with at least one prediction (you can't copy
  // from a group you haven't filled in yet).
  const sourceOptions = useMemo(
    () => myGroups.filter((g) => g.predictionsCount > 0),
    [myGroups],
  )

  // Available destinations: unlocked groups, excluding the chosen source.
  const destOptions = useMemo(
    () => myGroups.filter((g) => !g.locked && g.id !== sourceGroupId),
    [myGroups, sourceGroupId],
  )

  // groupId → slug map so the result view can build /comprobante links.
  const slugById = useMemo(() => new Map(myGroups.map((g) => [g.id, g.slug])), [myGroups])

  function toggleDest(id: string) {
    setDestGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function resetState() {
    setSourceGroupId('')
    setDestGroupIds(new Set(defaultDestGroupIds ?? []))
    setConflicts([])
    setConfirmOpen(false)
    setView('form')
    setCopiedResult([])
    setPhase('idle')
  }

  function handleSubmit(overwrite: boolean) {
    if (!sourceGroupId) {
      toast.error('Elige un grupo de origen.')
      return
    }
    if (destGroupIds.size === 0) {
      toast.error('Elige al menos un grupo de destino.')
      return
    }
    // Close the confirm sub-dialog before swapping the main dialog to the
    // overlay-driven saving view so they don't fight for focus.
    setConfirmOpen(false)
    setPhase('saving')
    startTransition(async () => {
      const r = await copyPredictions({
        sourceGroupId,
        destGroupIds: Array.from(destGroupIds),
        overwrite,
      })
      if (r.ok) {
        setPhase('success')
        // Same beat as the predict-form success → comprobante navigation.
        setTimeout(() => {
          setCopiedResult(
            r.copiedTo.map((c) => ({
              groupId: c.groupId,
              groupName: c.groupName,
              count: c.count,
              slug: slugById.get(c.groupId) ?? '',
            })),
          )
          setView('result')
          setPhase('idle')
          // Refresh the home so the chips reflect the new prediction counts.
          router.refresh()
        }, 800)
        return
      }
      setPhase('idle')
      if (r.code === 'needs_confirmation') {
        setConflicts(r.groupsWithPredictions)
        setConfirmOpen(true)
        return
      }
      toast.error(r.error)
    })
  }

  return (
    <>
      <SavingOverlay
        phase={phase}
        icon={Copy}
        savingTitle="Copiando predicciones"
        savingSubtitle="Replicando tus picks a los grupos elegidos"
        successTitle="¡Copiadas!"
        successSubtitle="Generando el comprobante…"
      />

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) resetState()
        }}
      >
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-md">
          {view === 'form' ? (
            <>
              <DialogHeader>
                <DialogTitle>Copiar predicciones entre grupos</DialogTitle>
                <DialogDescription>
                  Elige un grupo de origen y marca los grupos donde quieres pegar las mismas
                  predicciones.
                </DialogDescription>
              </DialogHeader>

              {sourceOptions.length === 0 ? (
                <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">
                    No tienes ningún grupo con predicciones.
                  </span>{' '}
                  Primero llena al menos un grupo manualmente. Después podrás copiar esas
                  predicciones a los demás.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="source">Grupo de origen</Label>
                    <Select value={sourceGroupId} onValueChange={setSourceGroupId}>
                      <SelectTrigger id="source">
                        <SelectValue placeholder="Elige el grupo cuyas predicciones quieres copiar" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceOptions.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name} · {g.predictionsCount}{' '}
                            {g.predictionsCount === 1 ? 'predicción' : 'predicciones'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Grupos de destino</Label>
                    {destOptions.length === 0 && sourceGroupId !== '' ? (
                      <p className="text-xs text-muted-foreground">
                        No tienes otros grupos abiertos donde copiar. Los grupos bloqueados no
                        aceptan cambios.
                      </p>
                    ) : destOptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Elige primero el origen para ver los destinos disponibles.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {destOptions.map((g) => {
                          const checked = destGroupIds.has(g.id)
                          const disabled =
                            lockDestSelection && defaultDestGroupIds?.includes(g.id)
                          return (
                            <label
                              key={g.id}
                              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 ${
                                checked ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/30'
                              } ${disabled ? 'pointer-events-none opacity-70' : ''}`}
                            >
                              <span className="flex min-w-0 items-center gap-2.5">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleDest(g.id)}
                                  aria-label={`Copiar a ${g.name}`}
                                  disabled={disabled}
                                />
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium">
                                    {g.name}
                                  </span>
                                  <span className="block text-[11px] text-muted-foreground">
                                    {g.predictionsCount === 0
                                      ? 'sin predicciones'
                                      : `ya tiene ${g.predictionsCount} ${
                                          g.predictionsCount === 1 ? 'predicción' : 'predicciones'
                                        }`}
                                  </span>
                                </span>
                              </span>
                              {g.locked && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Lock className="h-3 w-3" />
                                  Bloqueado
                                </span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOpen(false)
                    resetState()
                  }}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={
                    pending ||
                    sourceOptions.length === 0 ||
                    sourceGroupId === '' ||
                    destGroupIds.size === 0
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                  {pending ? 'Copiando…' : 'Copiar'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </DialogFooter>
            </>
          ) : (
            // Result view ("comprobante de copia") shown after a successful save.
            // Each row animates in with a fade-up stagger like the home group cards.
            <>
              <DialogHeader>
                <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-full bg-accent/15 text-accent animate-in zoom-in-50 duration-500">
                  <CheckCircle2 className="h-9 w-9" strokeWidth={2.2} aria-hidden />
                </div>
                <DialogTitle className="text-center">
                  ¡Listo! Copiadas a {copiedResult.length}{' '}
                  {copiedResult.length === 1 ? 'grupo' : 'grupos'}
                </DialogTitle>
                <DialogDescription className="text-center">
                  Tus predicciones quedaron sincronizadas. Puedes revisar el comprobante de cada
                  grupo para confirmar.
                </DialogDescription>
              </DialogHeader>

              <ul className="space-y-2">
                {copiedResult.map((c, i) => (
                  <li
                    key={c.groupId}
                    className="animate-fade-up"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <Link
                      href={`/groups/${c.slug}/comprobante`}
                      className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.groupName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {c.count} {c.count === 1 ? 'predicción copiada' : 'predicciones copiadas'}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                        Ver comprobante
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <DialogFooter>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setOpen(false)
                    resetState()
                  }}
                >
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Sobrescribir predicciones existentes?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Los siguientes grupos ya tienen predicciones tuyas. Si continúas, sus
                  predicciones se reemplazarán por las del grupo de origen:
                </p>
                <ul className="space-y-0.5 pl-4 text-sm text-foreground">
                  {conflicts.map((c) => (
                    <li key={c.groupId} className="list-disc">
                      <span className="font-medium">{c.groupName}</span>{' '}
                      <span className="text-muted-foreground">
                        ({c.count} {c.count === 1 ? 'predicción' : 'predicciones'})
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Esta acción no se puede deshacer automáticamente, pero puedes volver a editar las
                  predicciones manualmente desde cada grupo.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSubmit(true)} disabled={pending}>
              {pending ? 'Sobrescribiendo…' : 'Sí, sobrescribir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
