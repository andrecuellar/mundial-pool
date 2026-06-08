import { and, eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { LeaderboardTabs } from '@/components/leaderboard/leaderboard-tabs'
import { PoolBand } from '@/components/pool/pool-band'
import { db } from '@/db'
import { categories, groupCategories, groupMembers, groups } from '@/db/schema'
import { getPoolContributorIds, getPoolSummary } from '@/features/pool/queries'
import { sortByCategoryOrder } from '@/features/predictions/queries'
import { getLeaderboard } from '@/features/scoring/queries'
import { formatTimeOnly } from '@/lib/format'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const group = await db.query.groups.findFirst({
    where: eq(groups.slug, slug),
    columns: { name: true },
  })
  return {
    title: group ? `Tabla · ${group.name}` : 'Tabla de líderes',
  }
}

export default async function LeaderboardPage({ params }: Params) {
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

  const [leaderboard, catsRaw, pool, paidUserIds] = await Promise.all([
    getLeaderboard(group.id),
    db
      .select({
        id: categories.id,
        name: categories.name,
        key: categories.key,
        points: groupCategories.points,
      })
      .from(categories)
      .innerJoin(groupCategories, eq(groupCategories.categoryId, categories.id))
      .where(and(eq(groupCategories.groupId, group.id), eq(groupCategories.enabled, true))),
    getPoolSummary(group.id),
    getPoolContributorIds(group.id),
  ])
  const cats = sortByCategoryOrder(catsRaw)

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Player'
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null
  const hasScores = leaderboard.some((r) => r.totalPoints > 0)

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[{ label: group.name, href: `/groups/${slug}` }, { label: 'Tabla' }]}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <BackLink href={`/groups/${slug}`} label={group.name} className="mb-4" />
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Tabla de líderes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasScores ? (
            <>
              Última actualización ·{' '}
              <span className="font-mono text-foreground">{formatTimeOnly(new Date())}</span>
            </>
          ) : (
            <>
              Aún sin puntos · la tabla se llena cuando inicia el Mundial el{' '}
              <span className="font-medium text-foreground">11 de junio</span>.
            </>
          )}
        </p>

        {hasScores && <PoolBand pool={pool} />}

        <div className="mt-6">
          <LeaderboardTabs
            leaderboard={leaderboard}
            categories={cats}
            currentUserId={user.id}
            poolEnabled={pool.enabled}
            paidUserIds={Array.from(paidUserIds)}
            lockAt={group.predictionsLockAt.toISOString()}
            groupSlug={slug}
            groupName={group.name}
            isAdmin={membership.role === 'owner'}
          />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Los puntos se recalculan automáticamente con cada partido resuelto. Si dos o más
            jugadores empatan en puntos, comparten el puesto (T-N) y el premio correspondiente se
            divide en partes iguales entre ellos.
          </p>
        </div>
      </main>
    </>
  )
}
