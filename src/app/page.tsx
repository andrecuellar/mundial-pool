import { desc, eq, inArray, sql } from 'drizzle-orm'
import { ChevronRight, Plus, Users } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { CountdownBanner } from '@/components/countdown/countdown-banner'
import { PoolDisclaimer } from '@/components/legal/pool-disclaimer'
import { PushOptIn } from '@/components/notifications/push-opt-in'
import { OnboardingModal } from '@/components/onboarding/onboarding-modal'
import { PoolChip } from '@/components/pool/pool-chip'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { groupMembers, groups, poolTransactions, profiles } from '@/db/schema'
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
    columns: { onboardedAt: true },
  })
  const shouldOnboard = !myProfile?.onboardedAt

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

  const poolTotals =
    myGroups.length > 0
      ? await db
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
      : []
  const totalsByGroup = new Map(poolTotals.map((p) => [p.groupId, Number(p.total)]))

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

        <PoolDisclaimer variant="home" className="mt-4" />

        <div className="mt-4 flex flex-col gap-3 sm:fixed sm:top-20 sm:left-4 sm:z-40 sm:mt-0 sm:w-72 sm:max-w-xs">
          <PushOptIn vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
          <InstallPrompt />
        </div>

        {(() => {
          // Show one countdown — the nearest still-open lock among my groups.
          const now = Date.now()
          const next = myGroups
            .map((g) => ({ name: g.name, ts: g.predictionsLockAt.getTime() }))
            .filter((g) => g.ts > now)
            .sort((a, b) => a.ts - b.ts)[0]
          if (!next) return null
          return (
            <div className="mt-4">
              <CountdownBanner lockAt={new Date(next.ts).toISOString()} groupName={next.name} />
            </div>
          )
        })()}

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
              <Button asChild>
                <Link href="/groups/new">
                  <Plus className="h-4 w-4" />
                  Crear mi primer grupo
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/groups/join">Unirme con código</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <ul className="mt-6 space-y-3">
            {myGroups.map((g, i) => {
              const locked = new Date() >= g.predictionsLockAt
              const poolTotal = totalsByGroup.get(g.id) ?? 0
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
            <Button asChild className="h-12">
              <Link href="/groups/new">
                <Plus className="h-4 w-4" />
                Crear grupo
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-12">
              <Link href="/groups/join">Unirme con código</Link>
            </Button>
          </div>
        )}

        <div className="mt-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Datos del Mundial 2026
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Link
              href="/torneo/selecciones"
              className="hover-lift group flex items-start gap-3 rounded-xl border border-border bg-card p-4"
            >
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Tabla de las 48 selecciones</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Ranking 1→48 con desempates por penales, fair play y diferencia de gol.
                </p>
              </div>
            </Link>
            <Link
              href="/torneo/jugadores"
              className="hover-lift group flex items-start gap-3 rounded-xl border border-border bg-card p-4"
            >
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Goleadores y asistentes</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Top scorers y máximos asistentes según FIFA. Qué cuenta y qué no.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
