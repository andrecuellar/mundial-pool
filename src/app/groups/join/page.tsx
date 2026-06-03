import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { Card } from '@/components/ui/card'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { JoinGroupForm } from './join-group-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Unirme con código',
  description: 'Únete a un grupo existente con el código de invitación de 6 caracteres.',
}

export default async function JoinGroupPage() {
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
        breadcrumb={[{ label: 'Unirme con código' }]}
      />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8 sm:px-6">
        <BackLink href="/" label="Mis grupos" className="mb-4" />

        <Card className="p-6 sm:p-8">
          <h1 className="text-center text-2xl sm:text-3xl font-semibold tracking-tight">
            Unirme con código
          </h1>
          <p className="mt-2 mb-7 text-center text-sm text-muted-foreground">
            Pídele el código de invitación al creador del grupo.
          </p>
          <JoinGroupForm />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            El código tiene 6 caracteres, letras y números.
          </p>
        </Card>

        <div className="mt-4">
          <InstallPrompt />
        </div>
      </main>
    </>
  )
}
