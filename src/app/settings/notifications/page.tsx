import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { NotificationPreferencesForm } from '@/components/notifications/preferences-form'
import { getMyPreferences } from '@/features/auth/notification-preferences'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Notificaciones',
  description: 'Elige qué tipos de avisos quieres recibir de mundial-pool.',
}

export default async function NotificationsSettingsPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await getMyPreferences()
  const initial = result.ok
    ? result.preferences
    : ({} as Awaited<ReturnType<typeof getMyPreferences>> extends { preferences: infer P }
        ? P
        : never)

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Player'
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[{ label: 'Notificaciones' }]}
      />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <BackLink href="/" label="Inicio" className="mb-4" />
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Notificaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Elegí qué tipos de aviso querés recibir. Si tu navegador todavía no tiene permiso para
          notificaciones, primero activalas desde el banner "Activa las notificaciones del Mundial"
          en el inicio.
        </p>
        <div className="mt-6">
          <NotificationPreferencesForm initial={initial} />
        </div>
      </main>
    </>
  )
}
