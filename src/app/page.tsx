import { desc, eq, inArray, sql } from 'drizzle-orm'
import { ChevronRight, Plus, Users } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { PoolChip } from '@/components/pool/pool-chip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { groupMembers, groups, poolTransactions } from '@/db/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Mis grupos</h1>
          <span className="font-mono text-xs text-muted-foreground">
            {myGroups.length} {myGroups.length === 1 ? 'activo' : 'activos'}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Tus pools del Mundial 2026.</p>

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
            {myGroups.map((g) => {
              const locked = new Date() >= g.predictionsLockAt
              const poolTotal = totalsByGroup.get(g.id) ?? 0
              return (
                <li key={g.id}>
                  <Link href={`/groups/${g.slug}`} className="block">
                    <Card className="p-5 transition-colors hover:bg-muted/40">
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
                                  {g.predictionsLockAt.toLocaleString('es-BO', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
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
      </main>
    </>
  )
}
