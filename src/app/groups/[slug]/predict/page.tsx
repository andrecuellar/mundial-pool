import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { Download, Lock } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { CopyPredictionsDialog } from '@/components/predictions/copy-predictions-dialog'
import { Button } from '@/components/ui/button'
import { db } from '@/db'
import { groupMembers, groups, predictions } from '@/db/schema'
import { getPredictionForm, listAllPlayers, listAllTeams } from '@/features/predictions/queries'
import { formatDayTime } from '@/lib/format'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PredictionForm } from './prediction-form'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const group = await db.query.groups.findFirst({
    where: eq(groups.slug, slug),
    columns: { name: true },
  })
  return {
    title: group ? `Predicciones · ${group.name}` : 'Predicciones',
  }
}

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
  const [form, allTeams, allPlayers, otherGroupsRaw, myPredCount] = await Promise.all([
    getPredictionForm(group.id, user.id),
    listAllTeams(),
    listAllPlayers(),
    // Other groups the user belongs to — needed so the in-group "Importar" button
    // can offer them as copy sources. Excludes the current group.
    db
      .select({
        id: groups.id,
        name: groups.name,
        slug: groups.slug,
        predictionsLockAt: groups.predictionsLockAt,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(and(eq(groupMembers.userId, user.id), ne(groups.id, group.id))),
    db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(predictions)
      .where(and(eq(predictions.groupId, group.id), eq(predictions.userId, user.id))),
  ])

  // Per-group prediction counts for the OTHER groups, so the dialog can show
  // "ya tiene X predicciones" next to each option.
  const otherCountsRows =
    otherGroupsRaw.length > 0
      ? await db
          .select({
            groupId: predictions.groupId,
            n: sql<number>`COUNT(*)::int`,
          })
          .from(predictions)
          .where(
            and(
              inArray(
                predictions.groupId,
                otherGroupsRaw.map((g) => g.id),
              ),
              eq(predictions.userId, user.id),
            ),
          )
          .groupBy(predictions.groupId)
      : []
  const otherCountByGroup = new Map(otherCountsRows.map((r) => [r.groupId, r.n]))
  const currentPredCount = myPredCount[0]?.n ?? 0
  const anyOtherHasPredictions = otherGroupsRaw.some(
    (g) => (otherCountByGroup.get(g.id) ?? 0) > 0,
  )

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
                Esta vista es solo lectura desde el {formatDayTime(group.predictionsLockAt)}.
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

        {!locked && anyOtherHasPredictions && (
          <div className="mt-4">
            <CopyPredictionsDialog
              defaultDestGroupIds={[group.id]}
              lockDestSelection
              myGroups={[
                {
                  id: group.id,
                  name: group.name,
                  slug: group.slug,
                  locked: false,
                  predictionsCount: currentPredCount,
                },
                ...otherGroupsRaw.map((g) => ({
                  id: g.id,
                  name: g.name,
                  slug: g.slug,
                  locked: new Date() >= g.predictionsLockAt,
                  predictionsCount: otherCountByGroup.get(g.id) ?? 0,
                })),
              ]}
              trigger={
                <Button variant="secondary" size="sm" type="button">
                  <Download className="h-3.5 w-3.5" />
                  Importar predicciones de otro grupo
                </Button>
              }
            />
          </div>
        )}

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
