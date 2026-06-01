import { and, eq } from 'drizzle-orm'
import { Eye, EyeOff } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { AllPredictionsView } from '@/components/predictions/all-predictions-view'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { groupMembers, groups } from '@/db/schema'
import {
  getAllGroupPredictions,
  serialiseAllPredictionsView,
} from '@/features/predictions/queries'
import { formatDayTime } from '@/lib/format'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export default async function PredictionsPage({ params }: Params) {
  const { slug } = await params
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const group = await db.query.groups.findFirst({ where: eq(groups.slug, slug) })
  if (!group) notFound()

  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id)),
  })
  if (!membership) notFound()

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Player'
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null

  const locked = new Date() >= group.predictionsLockAt
  const rawView = locked ? await getAllGroupPredictions(group.id) : null
  const view = rawView ? serialiseAllPredictionsView(rawView) : null

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[{ label: group.name, href: `/groups/${slug}` }, { label: 'Apuestas' }]}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <BackLink href={`/groups/${slug}`} label={group.name} className="mb-4" />
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Apuestas del grupo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {locked
            ? 'Lo que apostó cada jugador en cada categoría.'
            : 'Las apuestas se mantienen ocultas hasta el cierre.'}
        </p>

        {locked && view ? (
          <div className="mt-6">
            <AllPredictionsView view={view} currentUserId={user.id} />
          </div>
        ) : (
          <Card className="mt-6 p-8 sm:p-10 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-dashed border-border bg-muted">
              <EyeOff className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Apuestas selladas</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
              Para que nadie pueda copiarse, las apuestas se revelan recién cuando se cierran las
              predicciones, el{' '}
              <span className="font-medium text-foreground">
                {formatDayTime(group.predictionsLockAt)}
              </span>
              . Hasta entonces solo puedes ver las tuyas.
            </p>
            <p className="mx-auto mt-4 flex max-w-md items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              Después del cierre, esta página mostrará la apuesta completa de cada miembro.
            </p>
          </Card>
        )}
      </main>
    </>
  )
}
