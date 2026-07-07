import { and, count, desc, eq } from 'drizzle-orm'
import { Check, ChevronRight, Lock, Share2, Sparkles, Users, Wallet } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { ResultCelebration } from '@/components/celebrations/result-celebration'
import { CountdownBanner } from '@/components/countdown/countdown-banner'
import { CopyCodeButton } from '@/components/groups/copy-code-button'
import { ShareButton } from '@/components/groups/share-button'
import { PushOptIn } from '@/components/notifications/push-opt-in'
import { PoolStatCard } from '@/components/pool/pool-stat-card'
import { PersonalStatsCard } from '@/components/stats/personal-stats-card'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { groupMembers, groups, poolTransactions, predictions, profiles, results } from '@/db/schema'
import { computePayout, getPoolSummary } from '@/features/pool/queries'
import { getRankedLeaderboard, getUserCategoryBreakdown } from '@/features/scoring/queries'
import { competitionRanks } from '@/features/scoring/rank'
import { env } from '@/lib/env'
import { formatDayShort, formatDayTime } from '@/lib/format'
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
    title: group?.name ?? 'Grupo',
  }
}

function daysUntil(target: Date): number {
  const ms = target.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

export default async function GroupPage({ params }: Params) {
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

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    'Player'
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null

  // Non-members get a 404 — we don't want to leak the group's existence or
  // name. The only entry into a group is via the invite code at /groups/join.
  if (!membership) notFound()

  const [
    leaderboard,
    pool,
    payoutPreview,
    [memberCountRow],
    allMembers,
    myPredictions,
    myBreakdown,
    [latestResolution],
    [myPoolPayment],
  ] = await Promise.all([
    getRankedLeaderboard(group.id),
    getPoolSummary(group.id),
    computePayout(group.id),
    db.select({ count: count() }).from(groupMembers).where(eq(groupMembers.groupId, group.id)),
    db
      .select({ displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
      .from(groupMembers)
      .innerJoin(profiles, eq(profiles.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, group.id))
      .limit(10),
    db
      .select({ count: count() })
      .from(predictions)
      .where(and(eq(predictions.groupId, group.id), eq(predictions.userId, user.id))),
    getUserCategoryBreakdown(group.id, user.id),
    db
      .select({ resolvedAt: results.resolvedAt })
      .from(results)
      .orderBy(desc(results.resolvedAt))
      .limit(1),
    db
      .select({ id: poolTransactions.id })
      .from(poolTransactions)
      .where(
        and(
          eq(poolTransactions.groupId, group.id),
          eq(poolTransactions.contributorUserId, user.id),
        ),
      )
      .limit(1),
  ])
  const hasPaid = Boolean(myPoolPayment)
  const latestResolvedAt = latestResolution?.resolvedAt ?? null
  // All-time wins for the user. The client compares latestResolvedAt against
  // localStorage to decide whether to celebrate (so this is cheap to send).
  const recentWins =
    latestResolvedAt && myBreakdown.length > 0
      ? myBreakdown
          .filter((r) => r.status === 'correct' && r.earnedPoints > 0)
          .map((r) => ({
            categoryKey: r.key,
            categoryName: r.name,
            earnedPoints: r.earnedPoints,
          }))
      : []

  const locked = new Date() >= group.predictionsLockAt
  const days = daysUntil(group.predictionsLockAt)
  const memberCount = memberCountRow.count
  const completedCount = myPredictions[0].count
  const totalPredictions = 14

  // Puesto de competición con el mismo desempate de la tabla: empatan solo
  // quienes igualan puntos Y fallos definitivos (1, 1, 3, 3, 5).
  const ranks = competitionRanks(leaderboard)
  const myIndex = leaderboard.findIndex((r) => r.userId === user.id)
  const myRank = myIndex >= 0 ? ranks[myIndex].rank : -1
  const myTied = myIndex >= 0 ? ranks[myIndex].tied : false

  const predictionsCtaState: 'locked' | 'empty' | 'partial' | 'done' = locked
    ? 'locked'
    : completedCount === 0
      ? 'empty'
      : completedCount === totalPredictions
        ? 'done'
        : 'partial'
  const predictionsCtaShouldGlow =
    predictionsCtaState === 'empty' || predictionsCtaState === 'partial'

  const showPoolCta = pool.enabled
  const poolCtaShouldGlow = showPoolCta && !hasPaid && !locked
  const predictionsCtaHeading =
    predictionsCtaState === 'locked'
      ? 'Mis predicciones'
      : predictionsCtaState === 'empty'
        ? '¡Empieza aquí!'
        : predictionsCtaState === 'partial'
          ? 'Continúa donde te quedaste'
          : '¡Listo, todo completo!'
  const predictionsCtaHelper =
    predictionsCtaState === 'locked'
      ? 'Solo lectura'
      : predictionsCtaState === 'empty'
        ? 'Toca para hacer tus 14 predicciones'
        : predictionsCtaState === 'partial'
          ? `Te faltan ${totalPredictions - completedCount} ${
              totalPredictions - completedCount === 1 ? 'categoría' : 'categorías'
            }`
          : 'Vuelve cuando quieras a revisarlas'
  const predictionsCtaProgress = completedCount / totalPredictions
  const poolCtaHeading = !showPoolCta
    ? 'Sin pozo'
    : hasPaid
      ? '¡Aporte confirmado!'
      : 'Aporta al pozo'
  const poolCtaHelper = !showPoolCta
    ? 'Este grupo no tiene pozo activo'
    : hasPaid
      ? 'El admin ya marcó tu aporte como recibido'
      : 'Mándale el aporte al admin y pídele que lo registre aquí'
  const poolCta = showPoolCta && (
    <Link href={`/groups/${slug}#pozo`} className="group block lg:h-full">
      <Card
        className={`relative flex flex-col overflow-hidden p-5 lg:h-full ${
          poolCtaShouldGlow ? 'mp-glow-border hover-lift-strong' : 'hover-lift'
        }`}
      >
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {poolCtaShouldGlow ? (
                <Wallet className="h-3 w-3 text-warning" />
              ) : hasPaid ? (
                <Check className="h-3 w-3 text-accent" />
              ) : (
                <Wallet className="h-3 w-3" />
              )}
              {poolCtaHeading}
            </p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                hasPaid ? 'text-accent' : poolCtaShouldGlow ? 'text-warning' : ''
              }`}
            >
              {hasPaid ? 'Pagado' : 'Pendiente'}
            </p>
            <p
              className={`mt-1 text-xs ${
                poolCtaShouldGlow ? 'text-warning' : 'text-muted-foreground'
              }`}
            >
              {poolCtaHelper}
            </p>
          </div>
          <ChevronRight
            className={`h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:text-primary ${
              poolCtaShouldGlow ? 'text-warning' : 'text-muted-foreground'
            }`}
          />
        </div>
      </Card>
    </Link>
  )

  const predictionsCta = (
    <Link href={`/groups/${slug}/predict`} className="group block lg:h-full">
      <Card
        className={`relative flex flex-col overflow-hidden p-5 lg:h-full ${
          predictionsCtaShouldGlow ? 'mp-glow-border hover-lift-strong' : 'hover-lift'
        }`}
      >
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {predictionsCtaShouldGlow && <Sparkles className="h-3 w-3 text-primary" />}
              {predictionsCtaHeading}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {completedCount}{' '}
              <span className="text-base text-muted-foreground">/ {totalPredictions}</span>
            </p>
            <p
              className={`mt-1 text-xs ${
                predictionsCtaShouldGlow ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {predictionsCtaHelper}
            </p>
          </div>
          <ChevronRight
            className={`h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:text-primary ${
              predictionsCtaShouldGlow ? 'text-primary' : 'text-muted-foreground'
            }`}
          />
        </div>
        <div className="relative z-10 mt-auto pt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="mp-progress-fill h-full rounded-full bg-gradient-to-r from-primary to-accent"
              style={{ width: `${Math.max(predictionsCtaProgress * 100, 6)}%` }}
            />
          </div>
        </div>
      </Card>
    </Link>
  )

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[{ label: group.name }]}
      />

      <ResultCelebration
        groupId={group.id}
        latestResolvedAt={latestResolvedAt ? latestResolvedAt.toISOString() : null}
        recentWins={recentWins}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <BackLink href="/" label="Mis grupos" className="mb-4" />

        <div className="flex flex-col gap-3 sm:fixed sm:top-20 sm:left-4 sm:z-40 sm:w-[22rem]">
          <PushOptIn vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
        </div>

        {!locked && (
          <div className="mb-4">
            <CountdownBanner
              lockAt={group.predictionsLockAt.toISOString()}
              groupName={group.name}
              context={
                completedCount === totalPredictions
                  ? '¡tus predicciones están listas!'
                  : `te faltan ${totalPredictions - completedCount} categorías`
              }
            />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="relative overflow-hidden border-none bg-primary p-6 sm:p-8 text-primary-foreground lg:row-span-2">
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                maskImage: 'radial-gradient(ellipse at top right, black, transparent 65%)',
              }}
            />
            <div className="relative">
              <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] opacity-80">
                <Users className="h-3 w-3" />
                Grupo · {memberCount} {memberCount === 1 ? 'jugador' : 'jugadores'}
              </p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
                {group.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {locked ? (
                  <Badge className="bg-white/15 text-white border-white/25">
                    <Lock className="h-3 w-3" />
                    Predicciones bloqueadas
                  </Badge>
                ) : (
                  <Badge className="bg-white/15 text-white border-white/25">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    Predicciones abiertas
                  </Badge>
                )}
                {myRank > 0 && (
                  <span className="opacity-80">
                    Vas en el lugar{' '}
                    <span
                      className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums"
                      title={myTied ? `Empate por el puesto ${myRank}` : `Puesto ${myRank}`}
                    >
                      {myRank}
                    </span>{' '}
                    <span className="opacity-100">de {leaderboard.length}</span>
                  </span>
                )}
              </div>

              {!locked && (
                <div className="mt-6 flex items-baseline gap-3">
                  <span
                    className="text-6xl sm:text-7xl font-bold leading-none tracking-tighter tabular-nums"
                    style={{ fontFeatureSettings: '"ss01"' }}
                  >
                    {days}
                  </span>
                  <div className="pb-2 space-y-1">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-75">
                      días para cerrar
                    </p>
                    <p className="text-sm font-medium">{formatDayTime(group.predictionsLockAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div className="lg:hidden space-y-4">
            {predictionsCta}
            {poolCta}
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  <Share2 className="h-3 w-3" />
                  Código de invitación
                </p>
                <p className="mt-2 font-mono text-2xl sm:text-3xl font-semibold tracking-[0.3em] text-primary">
                  {group.inviteCode}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                <CopyCodeButton code={group.inviteCode} groupName={group.name} />
                <ShareButton code={group.inviteCode} groupName={group.name} />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <Users className="h-3 w-3" />
              Miembros · {memberCount}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {allMembers.slice(0, 8).map((m) => (
                <div
                  key={m.displayName + m.avatarUrl}
                  title={m.displayName}
                  className="grid h-9 w-9 place-items-center rounded-full bg-muted text-xs font-medium text-foreground ring-2 ring-card overflow-hidden"
                >
                  {m.avatarUrl ? (
                    // biome-ignore lint/performance/noImgElement: external profile photo
                    <img
                      src={m.avatarUrl}
                      alt={m.displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    m.displayName
                      .split(/\s+/)
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  )}
                </div>
              ))}
              {memberCount > 8 && (
                <div className="grid h-9 w-9 place-items-center rounded-full border border-border bg-muted text-xs font-medium text-muted-foreground">
                  +{memberCount - 8}
                </div>
              )}
            </div>
          </Card>
        </div>

        {showPoolCta && (
          <div className="mt-6 hidden gap-4 lg:grid lg:grid-cols-2">
            {predictionsCta}
            {poolCta}
          </div>
        )}

        <div className={`mt-6 grid gap-4 ${showPoolCta ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
          {!showPoolCta && <div className="hidden lg:block">{predictionsCta}</div>}

          <Link href={`/groups/${slug}/leaderboard`} className="group block lg:h-full">
            <Card className="hover-lift flex flex-col p-5 lg:h-full">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Tabla de líderes
                  </p>
                  <p
                    className="mt-2 text-2xl font-semibold tabular-nums"
                    title={
                      myRank > 0
                        ? myTied
                          ? `Empate por el puesto ${myRank}`
                          : `Puesto ${myRank}`
                        : undefined
                    }
                  >
                    {myRank > 0 ? myRank : '—'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {leaderboard.length > 0
                      ? `de ${leaderboard.length} jugadores`
                      : 'Aún sin datos'}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <div className="mt-auto pt-4">
                {leaderboard.length > 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <span className="text-base leading-none">🏆</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Líder
                      </p>
                      <p className="truncate text-xs font-medium">{leaderboard[0].displayName}</p>
                    </div>
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {leaderboard[0].totalPoints}
                      <span className="ml-0.5 text-[10px] text-muted-foreground">pts</span>
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-center text-xs text-muted-foreground">
                    Se llena cuando inicie el Mundial
                  </div>
                )}
              </div>
            </Card>
          </Link>

          <div id="pozo" className="scroll-mt-24">
            <PoolStatCard
              pool={pool}
              payoutPreview={payoutPreview}
              groupSlug={slug}
              isOwner={membership.role === 'owner'}
            />
          </div>
        </div>

        <div className="mt-4">
          <PersonalStatsCard
            rows={myBreakdown}
            totalPoints={leaderboard.find((r) => r.userId === user.id)?.totalPoints ?? 0}
            rank={myRank > 0 ? myRank : null}
            rankLabel={myRank > 0 ? String(myRank) : null}
            totalPlayers={leaderboard.length}
          />
        </div>

        <Link href={`/groups/${slug}/predictions`} className="group mt-4 block">
          <Card className="hover-lift p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Apuestas del grupo
                </p>
                <p className="mt-2 text-sm">
                  {locked
                    ? `Mira lo que apostó cada uno de los ${memberCount} jugadores.`
                    : `Se revelan el ${formatDayShort(group.predictionsLockAt)}, junto con el cierre.`}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          </Card>
        </Link>
      </main>
    </>
  )
}
