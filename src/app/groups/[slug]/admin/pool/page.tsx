import { and, desc, eq } from 'drizzle-orm'
import { Wallet } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { DepositForm } from '@/components/pool/deposit-form'
import { PoolConfigForm } from '@/components/pool/pool-config-form'
import { PoolLedgerTable } from '@/components/pool/pool-ledger-table'
import { QrUploadCard } from '@/components/pool/qr-upload-card'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { groupMembers, groups, profiles } from '@/db/schema'
import { getPoolSummary, listPoolTransactions } from '@/features/pool/queries'
import { formatMoney } from '@/lib/format'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export default async function AdminPoolPage({ params }: Params) {
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
  if (membership.role !== 'owner') redirect(`/groups/${slug}`)

  const [pool, ledger, members] = await Promise.all([
    getPoolSummary(group.id),
    listPoolTransactions(group.id),
    db
      .select({
        userId: profiles.id,
        displayName: profiles.displayName,
      })
      .from(groupMembers)
      .innerJoin(profiles, eq(profiles.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, group.id))
      .orderBy(desc(profiles.displayName)),
  ])

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Player'
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[{ label: group.name, href: `/groups/${slug}` }, { label: 'Configurar pozo' }]}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <BackLink href={`/groups/${slug}`} label={group.name} className="mb-4" />

        <div className="mb-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <Wallet className="h-3.5 w-3.5 text-gold" />
              Admin · solo el creador
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Pozo del grupo</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              La app no procesa pagos — solo lleva el ledger. Configura cómo se reparte y registra
              cada depósito.
            </p>
          </div>
          <Card className="w-full border-gold/30 bg-gradient-to-br from-gold/5 to-transparent p-4 sm:w-auto sm:min-w-[220px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Total actual
            </p>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-semibold tabular-nums">
                {formatMoney(pool.total, pool.currency ?? 'BOB')}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                · {pool.transactionCount} {pool.transactionCount === 1 ? 'depósito' : 'depósitos'}
              </span>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground tracking-wider">01</span>
              <h2 className="text-base font-semibold">Configuración</h2>
            </div>
            <PoolConfigForm
              groupId={group.id}
              initial={{
                enabled: pool.enabled,
                currency: pool.currency,
                buyInAmount: pool.buyInAmount,
                payoutRule: pool.payoutRule,
              }}
              transactionCount={pool.transactionCount}
            />
            <div className="mt-6 border-t border-border pt-6">
              <QrUploadCard groupId={group.id} initialUrl={pool.qrUrl} />
            </div>
          </Card>

          <Card className="p-6 self-start">
            <div className="mb-4 flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground tracking-wider">02</span>
              <h2 className="text-base font-semibold">Registrar depósito</h2>
            </div>
            <DepositForm
              groupId={group.id}
              currency={pool.currency ?? 'BOB'}
              buyInAmount={pool.buyInAmount}
              members={members}
            />
          </Card>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground tracking-wider">03</span>
            <h2 className="text-base font-semibold">Ledger · todas las transacciones</h2>
          </div>
          <PoolLedgerTable
            rows={ledger}
            currency={pool.currency ?? 'BOB'}
            ownerMode
            groupId={group.id}
          />
        </div>
      </main>
    </>
  )
}
