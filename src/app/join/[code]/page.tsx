import { and, count, eq } from 'drizzle-orm'
import { CheckCircle2, Users } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app-shell/app-header'
import { Wordmark } from '@/components/app-shell/wordmark'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { groupMembers, groups } from '@/db/schema'
import { joinGroupAndRedirect } from '@/features/groups/actions'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ code: string }> }

export default async function JoinByCodePage({ params }: Params) {
  const { code } = await params
  const codeUpper = code.toUpperCase().trim()

  // Not authenticated? Send them to /login with a return URL so they land
  // back here after sign-in (or sign-up via magic link).
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const next = encodeURIComponent(`/join/${codeUpper}`)
    redirect(`/login?next=${next}`)
  }

  const group = await db.query.groups.findFirst({
    where: eq(groups.inviteCode, codeUpper),
  })

  // Invalid code: friendly error, no leak about other groups.
  if (!group) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4">
        <Wordmark size="md" />
        <Card className="mt-8 w-full p-6 text-center">
          <h1 className="text-xl font-semibold">Código no válido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            El código <code className="font-mono font-medium">{codeUpper}</code> no
            existe. Verifícalo con quien te invitó.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild>
              <Link href="/groups/join">Ingresar otro código</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">Ir al inicio</Link>
            </Button>
          </div>
        </Card>
      </main>
    )
  }

  const existing = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id)),
  })

  const [{ count: memberCount }] = await db
    .select({ count: count() })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, group.id))
  const locked = new Date() >= group.predictionsLockAt
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Player'
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null

  // Already a member: friendly "ya estás dentro" card instead of a silent
  // redirect so the user sees feedback when they tap an old invite link.
  if (existing) {
    return (
      <>
        <AppHeader
          user={{ name: displayName, email: user.email ?? null, avatarUrl }}
          breadcrumb={[{ label: 'Invitación' }]}
        />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
          <Card className="p-6 sm:p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl sm:text-2xl font-semibold tracking-tight">
              Ya estás en este grupo
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Ya eres miembro de{' '}
              <span className="font-medium text-foreground">{group.name}</span>. No
              necesitas volver a unirte.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
              {locked ? (
                <Badge variant="secondary">🔒 Predicciones bloqueadas</Badge>
              ) : (
                <Badge className="gap-1 border-accent/30 bg-accent/15 text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Predicciones abiertas
                </Badge>
              )}
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {memberCount} {memberCount === 1 ? 'jugador' : 'jugadores'}
              </span>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <Button asChild size="lg">
                <Link href={`/groups/${group.slug}`}>Ir al grupo</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/">Ver todos mis grupos</Link>
              </Button>
            </div>
          </Card>
        </main>
      </>
    )
  }

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[{ label: 'Invitación' }]}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <Card className="p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Te invitaron a un pool
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
            {group.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {locked ? (
              <Badge variant="secondary">🔒 Predicciones bloqueadas</Badge>
            ) : (
              <Badge className="gap-1 border-accent/30 bg-accent/15 text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Predicciones abiertas
              </Badge>
            )}
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {memberCount} {memberCount === 1 ? 'jugador' : 'jugadores'}
            </span>
          </div>

          <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
            Al unirte podrás hacer tus 13 predicciones del Mundial 2026 y aparecer en la
            tabla de líderes del grupo.
          </p>

          <form action={joinGroupAndRedirect} className="mt-6 space-y-2">
            <input type="hidden" name="inviteCode" value={codeUpper} />
            <Button type="submit" size="lg" className="w-full">
              Unirme al grupo
            </Button>
            <Button asChild variant="ghost" size="lg" className="w-full">
              <Link href="/">Cancelar</Link>
            </Button>
          </form>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Código de invitación:{' '}
            <span className="font-mono text-foreground">{codeUpper}</span>
          </p>
        </Card>
      </main>
    </>
  )
}
