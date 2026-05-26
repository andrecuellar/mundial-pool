import { and, eq } from 'drizzle-orm'
import { Clock, Wallet } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { LeaderboardTabs } from '@/components/leaderboard/leaderboard-tabs'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { categories, groupCategories, groupMembers, groups } from '@/db/schema'
import { getPoolSummary } from '@/features/pool/queries'
import { getLeaderboard } from '@/features/scoring/queries'
import { formatMoney, payoutRuleLabel } from '@/lib/format'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

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
  if (!membership) redirect(`/groups/${slug}`)

  const [leaderboard, cats, pool] = await Promise.all([
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
  ])

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
        <Link
          href={`/groups/${slug}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          ← {group.name}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Tabla de líderes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Última actualización ·{' '}
          <span className="font-mono text-foreground">
            {new Date().toLocaleTimeString('es-BO', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </p>

        {pool.enabled && hasScores && (
          <Card className="mt-5 flex flex-wrap items-center justify-between gap-3 border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-gold" />
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Pozo actual
              </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(pool.total, pool.currency ?? 'BOB')}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Payout: {payoutRuleLabel(pool.payoutRule)}
            </span>
          </Card>
        )}

        {leaderboard.length === 0 || !hasScores ? (
          <Card className="mt-6 p-12 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border border-dashed border-border bg-muted">
              <Clock className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Aún no hay puntos</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              La tabla se actualiza cuando inicia el Mundial. Vuelve después del partido inaugural
              el <span className="font-medium text-foreground">11 de junio</span>.
            </p>
          </Card>
        ) : (
          <div className="mt-6">
            <LeaderboardTabs leaderboard={leaderboard} categories={cats} currentUserId={user.id} />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Los puntos se recalculan automáticamente con cada partido resuelto.
            </p>
          </div>
        )}
      </main>
    </>
  )
}
