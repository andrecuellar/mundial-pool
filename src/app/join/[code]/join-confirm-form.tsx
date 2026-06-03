'use client'

import { UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SavingOverlay } from '@/components/app-shell/saving-overlay'
import { Button } from '@/components/ui/button'
import { joinGroup } from '@/features/groups/actions'

type Props = {
  inviteCode: string
}

// Client confirm form for the invite link landing page. Replaces the raw
// <form action={joinGroupAndRedirect}> so we can render a full-screen
// SavingOverlay while the server action runs. Without this, the user clicks
// "Unirme al grupo" and sees no feedback for 1-5s while the action lands —
// which led to the reported "se colgó" bug.
export function JoinConfirmForm({ inviteCode }: Props) {
  const [phase, setPhase] = useState<'idle' | 'saving' | 'success'>('idle')
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPhase('saving')
    startTransition(async () => {
      const fd = new FormData()
      fd.set('inviteCode', inviteCode)
      const r = await joinGroup(fd)
      if (r.ok) {
        setPhase('success')
        // Hold the ✓ visible for a beat before navigating, same beat as
        // new-group-form so the user processes the success state.
        setTimeout(() => {
          window.location.href = `/groups/${r.data.slug}`
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
        icon={UserPlus}
        savingTitle="Uniéndote al grupo"
        savingSubtitle="Confirmando tu invitación"
        successTitle="¡Listo!"
        successSubtitle="Te llevamos a tu nuevo grupo"
      />
      <form onSubmit={handleSubmit} className="mt-6 space-y-2">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Uniéndote…' : 'Unirme al grupo'}
        </Button>
        <Button asChild variant="ghost" size="lg" className="w-full" disabled={pending}>
          <Link href="/">Cancelar</Link>
        </Button>
      </form>
    </>
  )
}
