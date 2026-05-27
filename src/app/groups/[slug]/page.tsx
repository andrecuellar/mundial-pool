import { and, count, eq } from 'drizzle-orm'
import { ChevronRight, Lock, Share2, Users } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { CopyCodeButton } from '@/components/groups/copy-code-button'
import { ShareButton } from '@/components/groups/share-button'
import { PoolStatCard } from '@/components/pool/pool-stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { groupMembers, groups, predictions, profiles } from '@/db/schema'
import { computePayout, getPoolSummary } from '@/features/pool/queries'
import { getLeaderboard } from '@/features/scoring/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

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

  const [leaderboard, pool, payoutPreview, [memberCountRow], allMembers, myPredictions] =
    await Promise.all([
      getLeaderboard(group.id),
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
    ])

  const locked = new Date() >= group.predictionsLockAt
  const days = daysUntil(group.predictionsLockAt)
  const memberCount = memberCountRow.count
  const completedCount = myPredictions[0].count
  const totalPredictions = 14

  // Competition rank: ties share a position (1, 1, 3, 3, 5).
  let myRank = -1
  let myTied = false
  {
    let prevPoints: number | null = null
    let prevRank = 0
    for (let i = 0; i < leaderboard.length; i++) {
      const r = leaderboard[i]
      const rank = prevPoints !== null && r.totalPoints === prevPoints ? prevRank : i + 1
      if (r.userId === user.id) {
        myRank = rank
      }
      prevPoints = r.totalPoints
      prevRank = rank
    }
    if (myRank > 0) {
      const me = leaderboard.find((r) => r.userId === user.id)
      myTied = leaderboard.filter((r) => r.totalPoints === me?.totalPoints).length > 1
    }
  }

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[{ label: group.name }]}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <BackLink href="/" label="Mis grupos" className="mb-4" />

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="relative overflow-hidden border-none bg-primary p-6 sm:p-8 text-primary-foreground">
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
                    <span className="font-medium opacity-100">
                      {myTied ? `T-${myRank}` : `#${myRank}`} de {leaderboard.length}
                    </span>
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
                    <p className="text-sm font-medium">
                      {group.predictionsLockAt.toLocaleString('es-BO', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-4">
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
                  <CopyCodeButton code={group.inviteCode} />
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
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Link href={`/groups/${slug}/predict`}>
            <Card className="hover-lift p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Mis predicciones
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {completedCount} / {totalPredictions}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {locked
                      ? 'Solo lectura'
                      : completedCount === totalPredictions
                        ? 'Completas'
                        : `${totalPredictions - completedCount} pendientes`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Card>
          </Link>

          <Link href={`/groups/${slug}/leaderboard`}>
            <Card className="hover-lift p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Tabla de líderes
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {myRank > 0 ? (myTied ? `T-${myRank}` : `#${myRank}`) : '—'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {leaderboard.length > 0
                      ? `de ${leaderboard.length} jugadores`
                      : 'Aún sin datos'}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Card>
          </Link>

          <PoolStatCard
            pool={pool}
            payoutPreview={payoutPreview}
            groupSlug={slug}
            isOwner={membership.role === 'owner'}
          />
        </div>

        <Link href={`/groups/${slug}/predictions`} className="mt-4 block">
          <Card className="hover-lift p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Apuestas del grupo
                </p>
                <p className="mt-2 text-sm">
                  {locked
                    ? `Mira lo que apostó cada uno de los ${memberCount} jugadores.`
                    : `Se revelan el ${group.predictionsLockAt.toLocaleString('es-BO', {
                        day: '2-digit',
                        month: 'short',
                      })}, junto con el cierre.`}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
        </Link>
      </main>
    </>
  )
}
