import { Bolt } from 'lucide-react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { Card } from '@/components/ui/card'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NewGroupForm } from './new-group-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Crear grupo',
  description: 'Crea un grupo y comparte un código de 6 caracteres con tus amigos.',
}

export default async function NewGroupPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Player'
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[{ label: 'Crear grupo' }]}
      />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:px-6">
        <BackLink href="/" label="Mis grupos" className="mb-4" />

        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Crear grupo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu grupo tendrá un código de invitación de 6 caracteres para compartir.
          </p>

          <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/40 p-3">
            <div className="flex items-start gap-2.5">
              <Bolt className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Las 14 categorías del Mundial 2026 (campeón, goleador, balón de oro…) se activan
                automáticamente. No necesitas configurarlas.
              </p>
            </div>
          </div>

          <NewGroupForm />
        </Card>
      </main>
    </>
  )
}
