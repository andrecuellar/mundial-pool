'use client'

import { RefreshCw } from 'lucide-react'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { forceResolution } from '@/features/admin/actions'

/**
 * Botón para forzar la resolución del Mundial al instante (mismo runResolution()
 * que el cron). Útil para resolver apenas termina un partido — p.ej. la final —
 * sin esperar a la corrida programada.
 */
export function ForceResolutionButton() {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await forceResolution()
          if (result.ok) toast.success(result.message)
          else toast.error(result.error)
        })
      }
    >
      <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
      {pending ? 'Resolviendo…' : 'Resolver ahora'}
    </Button>
  )
}
