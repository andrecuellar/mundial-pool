import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { Card } from '@/components/ui/card'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { JoinGroupForm } from './join-group-form'

export const dynamic = 'force-dynamic'

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
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver a mis grupos
        </Link>

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
      </main>
    </>
  )
}
