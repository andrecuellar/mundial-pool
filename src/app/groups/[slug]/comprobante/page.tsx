import { and, eq } from 'drizzle-orm'
import { CheckCircle2, Pencil, Trophy } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { BackLink } from '@/components/app-shell/back-link'
import { renderPick } from '@/components/predictions/all-predictions-view'
import { ShareComprobanteButton } from '@/components/predictions/share-comprobante-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { groupMembers, groups } from '@/db/schema'
import { getUserComprobante } from '@/features/predictions/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export default async function ComprobantePage({ params }: Params) {
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

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    'Player'
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null

  const comprobante = await getUserComprobante(group.id, user.id)
  const locked = new Date() >= group.predictionsLockAt
  const isComplete = comprobante.filledCount === comprobante.totalCount

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[
          { label: group.name, href: `/groups/${slug}` },
          { label: 'Comprobante' },
        ]}
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <BackLink href={`/groups/${slug}`} label={group.name} className="mb-4" />

        <Card id="comprobante-card" className="overflow-hidden bg-card p-0">
          <div className="border-b border-border bg-muted/30 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  <Trophy className="h-3 w-3 text-primary" />
                  Comprobante de predicciones
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {group.name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  A nombre de{' '}
                  <span className="font-medium text-foreground">{displayName}</span>
                </p>
              </div>
              {isComplete ? (
                <Badge className="shrink-0 border-accent/30 bg-accent/15 text-accent">
                  <CheckCircle2 className="h-3 w-3" />
                  Completo
                </Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0">
                  {comprobante.filledCount} / {comprobante.totalCount}
                </Badge>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div>
                <dt className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
                  Categorías
                </dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                  {comprobante.filledCount} / {comprobante.totalCount}
                </dd>
              </div>
              <div>
                <dt className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
                  Última edición
                </dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {comprobante.lastUpdatedAt
                    ? comprobante.lastUpdatedAt.toLocaleString('es-BO', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
                  Cierre del grupo
                </dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {group.predictionsLockAt.toLocaleString('es-BO', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </dd>
              </div>
            </dl>
          </div>

          <ul className="divide-y divide-border">
            {comprobante.categories.map((cat, i) => (
              <li
                key={cat.id}
                className="flex items-start justify-between gap-3 px-5 py-3 text-sm sm:px-6"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 text-muted-foreground">{cat.name}</span>
                </div>
                <span className="text-right text-foreground">
                  {renderPick(comprobante.picks.get(cat.id))}
                </span>
              </li>
            ))}
          </ul>

          <div className="border-t border-border bg-muted/20 px-5 py-3 text-center text-[11px] text-muted-foreground sm:px-6">
            mundial•pool · Mundial 2026
          </div>
        </Card>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <ShareComprobanteButton
            targetId="comprobante-card"
            fileName={`mundial-pool-${slug}-${displayName.toLowerCase().replace(/\s+/g, '-')}`}
            shareTitle={`Mis predicciones · ${group.name}`}
            shareText={`Mis predicciones del Mundial 2026 para ${group.name} en mundial-pool.`}
          />
          {!locked && (
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href={`/groups/${slug}/predict`}>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Link>
            </Button>
          )}
          <Button asChild variant="secondary" size="lg" className="w-full sm:flex-1">
            <Link href={`/groups/${slug}`}>Volver al grupo</Link>
          </Button>
        </div>
      </main>
    </>
  )
}
