import { and, eq } from 'drizzle-orm'
import { Lock } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { db } from '@/db'
import { groupMembers, groups } from '@/db/schema'
import { getPredictionForm, listAllPlayers, listAllTeams } from '@/features/predictions/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PredictionForm } from './prediction-form'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export default async function PredictPage({ params }: Params) {
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

  const locked = new Date() >= group.predictionsLockAt
  const [form, allTeams, allPlayers] = await Promise.all([
    getPredictionForm(group.id, user.id),
    listAllTeams(),
    listAllPlayers(),
  ])

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Player'
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[{ label: group.name, href: `/groups/${slug}` }, { label: 'Mis predicciones' }]}
      />

      {locked && (
        <div className="border-b border-warning/30 bg-warning/10 px-4 sm:px-8 py-3">
          <div className="mx-auto flex max-w-4xl items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-warning" />
            <span>
              <span className="font-medium">Las predicciones están bloqueadas.</span>{' '}
              <span className="text-muted-foreground">
                Esta vista es solo lectura desde el{' '}
                {group.predictionsLockAt.toLocaleString('es-BO', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                .
              </span>
            </span>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <BackLink href={`/groups/${slug}`} label={group.name} className="mb-4" />
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Mis predicciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Llena las 14 categorías antes del partido inaugural. Se guardan con un solo botón al
          final.
        </p>

        <div className="mt-6">
          <PredictionForm
            groupSlug={slug}
            categories={form}
            teams={allTeams.map((t) => ({
              id: t.id,
              name: t.name,
              flagEmoji: t.flagEmoji,
              fifaCode: t.fifaCode,
              fifaRanking: t.fifaRanking,
            }))}
            players={allPlayers}
            locked={locked}
          />
        </div>
      </main>
    </>
  )
}
