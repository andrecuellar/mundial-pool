import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { ChevronRight, Copy, Users } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { NavButton } from '@/components/app-shell/nav-button'
import { CreateGroupCTA } from '@/components/groups/create-group-cta'
import { DualPendingBanner } from '@/components/groups/dual-pending-banner'
import { GroupCardChips } from '@/components/groups/group-card-chips'
import { GroupRequestRejectedBanner } from '@/components/groups/group-request-rejected-banner'
import { DataMundialSection } from '@/components/home/data-mundial-section'
import { PoolDisclaimerHome } from '@/components/legal/pool-disclaimer-home'
import { PushOptIn } from '@/components/notifications/push-opt-in'
import { OnboardingModal } from '@/components/onboarding/onboarding-modal'
import { PendingPaymentsBanner } from '@/components/pool/pending-payments-banner'
import { PoolChip } from '@/components/pool/pool-chip'
import { CopyPredictionsDialog } from '@/components/predictions/copy-predictions-dialog'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import {
  groupCreationRequests,
  groupMembers,
  groups,
  poolTransactions,
  predictions,
  profiles,
} from '@/db/schema'
import { isSuperAdminEmail } from '@/lib/admin'
import { env } from '@/lib/env'
import { formatDayTime } from '@/lib/format'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const myProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { onboardedAt: true, canCreateGroups: true, email: true },
  })
  const shouldOnboard = !myProfile?.onboardedAt
  const isAdminMe = myProfile?.email ? isSuperAdminEmail(myProfile.email) : false
  const canCreateGroups = isAdminMe || myProfile?.canCreateGroups || false

  // For users without the capability, peek at their most recent request to
  // tune the CTA between "pendiente" / "volver a pedir" / "pedir".
  let pendingRequestId: string | null = null
  let lastRejectedAt: Date | null = null
  let lastRejectionReason: string | null = null
  if (!canCreateGroups) {
    const recent = await db
      .select({
        id: groupCreationRequests.id,
        status: groupCreationRequests.status,
        reviewedAt: groupCreationRequests.reviewedAt,
        rejectionReason: groupCreationRequests.rejectionReason,
      })
      .from(groupCreationRequests)
      .where(eq(groupCreationRequests.userId, user.id))
      .orderBy(desc(groupCreationRequests.createdAt))
      .limit(1)
    const last = recent[0]
    if (last?.status === 'pending') pendingRequestId = last.id
    else if (last?.status === 'rejected') {
      lastRejectedAt = last.reviewedAt
      lastRejectionReason = last.rejectionReason
    }
  }

  const myGroups = await db
    .select({
      id: groups.id,
      slug: groups.slug,
      name: groups.name,
      predictionsLockAt: groups.predictionsLockAt,
      role: groupMembers.role,
      poolEnabled: groups.poolEnabled,
      poolCurrency: groups.poolCurrency,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, user.id))
    .orderBy(desc(groups.createdAt))

  // Si el usuario pertenece a un solo grupo, mostrar una lista de un único
  // elemento no aporta: lo mandamos directo al home de ese grupo. Los que aún
  // deben completar el onboarding lo ven primero (no los redirigimos).
  if (!shouldOnboard && myGroups.length === 1) {
    redirect(`/groups/${myGroups[0].slug}`)
  }

  const poolGroupIds = myGroups.filter((g) => g.poolEnabled).map((g) => g.id)
  const [poolTotals, myPaidRows, myPredCountRows] = await Promise.all([
    myGroups.length > 0
      ? db
          .select({
            groupId: poolTransactions.groupId,
            total: sql<string>`COALESCE(SUM(${poolTransactions.amount}), 0)`,
          })
          .from(poolTransactions)
          .where(
            inArray(
              poolTransactions.groupId,
              myGroups.map((g) => g.id),
            ),
          )
          .groupBy(poolTransactions.groupId)
      : Promise.resolve([] as { groupId: string; total: string }[]),
    poolGroupIds.length > 0
      ? db
          .select({ groupId: poolTransactions.groupId })
          .from(poolTransactions)
          .where(
            and(
              inArray(poolTransactions.groupId, poolGroupIds),
              eq(poolTransactions.contributorUserId, user.id),
            ),
          )
      : Promise.resolve([] as { groupId: string }[]),
    myGroups.length > 0
      ? db
          .select({
            groupId: predictions.groupId,
            n: sql<number>`COUNT(*)::int`,
          })
          .from(predictions)
          .where(
            and(
              inArray(
                predictions.groupId,
                myGroups.map((g) => g.id),
              ),
              eq(predictions.userId, user.id),
            ),
          )
          .groupBy(predictions.groupId)
      : Promise.resolve([] as { groupId: string; n: number }[]),
  ])
  const totalsByGroup = new Map(poolTotals.map((p) => [p.groupId, Number(p.total)]))
  const paidGroupIdsForMe = new Set(myPaidRows.map((p) => p.groupId))
  const predCountByGroup = new Map(myPredCountRows.map((r) => [r.groupId, r.n]))
  const pendingPaymentGroups = myGroups
    .filter((g) => g.poolEnabled && !paidGroupIdsForMe.has(g.id))
    .map((g) => ({ id: g.id, name: g.name, slug: g.slug, isOwner: g.role === 'owner' }))

  // Banner urgente para grupos donde no pagó NI predijo Y el lock está a ≤3
  // días. Es la combinación más crítica — la cuota de pago + las predicciones
  // se pierden si no actúa ya.
  const dualPendingGroups = myGroups
    .filter((g) => {
      if (new Date() >= g.predictionsLockAt) return false
      const days = Math.ceil((g.predictionsLockAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      if (days > 3) return false
      const noPredictions = (predCountByGroup.get(g.id) ?? 0) === 0
      const noPayment = g.poolEnabled && !paidGroupIdsForMe.has(g.id)
      return noPredictions && noPayment
    })
    .map((g) => ({
      slug: g.slug,
      name: g.name,
      daysUntilLock: Math.max(
        0,
        Math.ceil((g.predictionsLockAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      ),
    }))

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    'Player'
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null

  return (
    <>
      <AppHeader user={{ name: displayName, email: user.email ?? null, avatarUrl }} />
      <OnboardingModal shouldShow={shouldOnboard} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Mis grupos</h1>
          <span className="font-mono text-xs text-muted-foreground">
            {myGroups.length} {myGroups.length === 1 ? 'activo' : 'activos'}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Tus pools del Mundial 2026.</p>

        <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm leading-relaxed">
          Aquí no perdemos el tiempo como otras apps que te obligan a predecir{' '}
          <span className="font-medium text-foreground">Congo vs Uzbekistán</span> o{' '}
          <span className="font-medium text-foreground">Haití vs Escocia</span>{' '}
          <span className="animate-chef-kiss" aria-label="chef's kiss">
            🤌🏽
          </span>
        </div>

        {lastRejectedAt && (
          <GroupRequestRejectedBanner
            reason={lastRejectionReason}
            rejectedAt={lastRejectedAt}
            className="mt-4"
          />
        )}

        <PoolDisclaimerHome className="mt-4" />

        {dualPendingGroups.length > 0 && (
          <DualPendingBanner groups={dualPendingGroups} className="mt-4" />
        )}

        {pendingPaymentGroups.length > 0 && (
          <PendingPaymentsBanner groups={pendingPaymentGroups} className="mt-4" />
        )}

        <div className="mt-4 flex flex-col gap-3 sm:fixed sm:top-20 sm:left-4 sm:z-40 sm:mt-0 sm:w-[22rem]">
          <PushOptIn vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
          <InstallPrompt />
        </div>

        {myGroups.length === 0 ? (
          <Card className="mt-8 flex flex-col items-center gap-3 p-10 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Aún no tienes grupos</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crea uno e invita a tus amigos con un código de 6 caracteres, o únete a uno existente.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <CreateGroupCTA
                canCreate={canCreateGroups}
                pendingRequestId={pendingRequestId}
                lastRejectedAt={lastRejectedAt}
                lastRejectionReason={lastRejectionReason}
                variant="primary"
                isFirstGroup
              />
              <NavButton href="/groups/join" variant="secondary">
                Unirme con código
              </NavButton>
            </div>
          </Card>
        ) : (
          <ul className="mt-6 space-y-3">
            {myGroups.map((g, i) => {
              const locked = new Date() >= g.predictionsLockAt
              const poolTotal = totalsByGroup.get(g.id) ?? 0
              const daysUntilLock = Math.max(
                0,
                Math.ceil((g.predictionsLockAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
              )
              return (
                <li
                  key={g.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <Link href={`/groups/${g.slug}`} className="group block">
                    <Card className="hover-lift p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold tracking-tight">{g.name}</h3>
                            {g.role === 'owner' && (
                              <Badge variant="secondary" className="text-[10px]">
                                Admin
                              </Badge>
                            )}
                            {g.poolEnabled && (
                              <PoolChip total={poolTotal} currency={g.poolCurrency} />
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                locked
                                  ? 'bg-muted-foreground'
                                  : 'bg-accent shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_20%,transparent)]'
                              }`}
                            />
                            {locked ? (
                              'Bloqueado · esperando resultados'
                            ) : (
                              <>
                                Cierra{' '}
                                <span className="font-medium text-foreground">
                                  {formatDayTime(g.predictionsLockAt)}
                                </span>
                              </>
                            )}
                          </div>
                          <GroupCardChips
                            predictionsCompleted={predCountByGroup.get(g.id) ?? 0}
                            totalPredictions={14}
                            locked={locked}
                            poolEnabled={g.poolEnabled}
                            hasPaid={paidGroupIdsForMe.has(g.id)}
                            daysUntilLock={daysUntilLock}
                          />
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                    </Card>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {myGroups.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-2">
            <CreateGroupCTA
              canCreate={canCreateGroups}
              pendingRequestId={pendingRequestId}
              lastRejectedAt={lastRejectedAt}
              lastRejectionReason={lastRejectionReason}
              variant="grid"
            />
            <NavButton href="/groups/join" variant="secondary" className="h-12">
              Unirme con código
            </NavButton>
          </div>
        )}

        {myGroups.length >= 2 && (
          <CopyPredictionsDialog
            myGroups={myGroups.map((g) => ({
              id: g.id,
              name: g.name,
              slug: g.slug,
              locked: new Date() >= g.predictionsLockAt,
              predictionsCount: predCountByGroup.get(g.id) ?? 0,
            }))}
            trigger={
              <Button variant="outline" className="mp-pulse-soft mt-2 h-11 w-full">
                <Copy className="h-4 w-4" />
                Copiar mi predicción a otros grupos
              </Button>
            }
          />
        )}

        <DataMundialSection />
      </main>
    </>
  )
}
