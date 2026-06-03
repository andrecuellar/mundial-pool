'use client'

import { ArrowRight, Copy, Lock } from 'lucide-react'
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

  // Available sources: groups with at least one prediction (you can't copy from
  // a group you haven't filled in yet).
  const sourceOptions = useMemo(
    () => myGroups.filter((g) => g.predictionsCount > 0),
    [myGroups],
  )

  // Available destinations: unlocked groups, excluding the chosen source.
  const destOptions = useMemo(
    () => myGroups.filter((g) => !g.locked && g.id !== sourceGroupId),
    [myGroups, sourceGroupId],
  )

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
    startTransition(async () => {
      const r = await copyPredictions({
        sourceGroupId,
        destGroupIds: Array.from(destGroupIds),
        overwrite,
      })
      if (r.ok) {
        toast.success(
          `Predicciones copiadas a ${r.copiedTo.length} ${
            r.copiedTo.length === 1 ? 'grupo' : 'grupos'
          }`,
        )
        setOpen(false)
        setConfirmOpen(false)
        resetState()
        router.refresh()
        return
      }
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
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) resetState()
        }}
      >
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copiar predicciones entre grupos</DialogTitle>
            <DialogDescription>
              Elige un grupo de origen y marca los grupos donde quieres pegar las mismas
              predicciones.
            </DialogDescription>
          </DialogHeader>

          {sourceOptions.length === 0 ? (
            <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">No tienes ningún grupo con
              predicciones.</span>{' '}
              Primero llena al menos un grupo manualmente. Después podrás copiar esas predicciones
              a los demás.
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
                    No tienes otros grupos abiertos donde copiar. Los grupos bloqueados no aceptan
                    cambios.
                  </p>
                ) : destOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Elige primero el origen para ver los destinos disponibles.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {destOptions.map((g) => {
                      const checked = destGroupIds.has(g.id)
                      const disabled = lockDestSelection && defaultDestGroupIds?.includes(g.id)
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
                  Esta acción no se puede deshacer automáticamente, pero podés volver a editar las
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
