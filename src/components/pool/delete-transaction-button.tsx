'use client'

import { Trash2 } from 'lucide-react'
import { useTransition } from 'react'
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
import { deletePoolTransaction } from '@/features/pool/actions'

type Props = {
  groupId: string
  transactionId: string
  label: string
}

export function DeleteTransactionButton({ groupId, transactionId, label }: Props) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const r = await deletePoolTransaction({ groupId, transactionId })
      if (r.ok) toast.success('Depósito eliminado')
      else toast.error(r.error)
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          aria-label="Eliminar depósito"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar depósito</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Eliminar este depósito de {label}? Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
