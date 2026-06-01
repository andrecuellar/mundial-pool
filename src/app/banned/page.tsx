import { eq } from 'drizzle-orm'
import { AlertOctagon } from 'lucide-react'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { signOut } from '@/features/auth/actions'
import { SUPER_ADMIN_EMAILS } from '@/lib/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function BannedPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { bannedAt: true, bannedReason: true },
  })
  if (!profile?.bannedAt) redirect('/')

  const contactEmail = [...SUPER_ADMIN_EMAILS][0] ?? 'soporte@mundial-pool'

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertOctagon className="h-8 w-8" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Tu cuenta fue suspendida</h1>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        Un administrador suspendió el acceso de esta cuenta a mundial-pool. Tus datos no fueron
        eliminados — si esta cuenta se reactiva, podrás volver a entrar.
      </p>
      {profile.bannedReason && (
        <div className="mt-5 w-full rounded-lg border border-border bg-card p-3 text-left">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Motivo
          </p>
          <p className="mt-1 text-sm">{profile.bannedReason}</p>
        </div>
      )}
      <p className="mt-5 text-xs text-muted-foreground">
        Si crees que es un error, escribe a{' '}
        <a href={`mailto:${contactEmail}`} className="underline underline-offset-2">
          {contactEmail}
        </a>
        .
      </p>
      <form action={signOut} className="mt-8 w-full">
        <Button type="submit" variant="outline" size="lg" className="w-full">
          Cerrar sesión
        </Button>
      </form>
    </main>
  )
}
