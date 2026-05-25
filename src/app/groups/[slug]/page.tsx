import { and, eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/db'
import { groupMembers, groups } from '@/db/schema'
import { getLeaderboard } from '@/features/scoring/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

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
  if (!membership) {
    return (
      <main style={{ maxWidth: 600, margin: '4rem auto', fontFamily: 'sans-serif' }}>
        <h1>{group.name}</h1>
        <p>No eres miembro de este grupo. Pídele el código de invitación al creador.</p>
        <Link href="/groups/join">Ingresar código</Link>
      </main>
    )
  }

  const leaderboard = await getLeaderboard(group.id)
  const locked = new Date() >= group.predictionsLockAt
  const isOwner = membership.role === 'owner'

  return (
    <main style={{ maxWidth: 720, margin: '4rem auto', fontFamily: 'sans-serif' }}>
      <p>
        <Link href="/">← Mis grupos</Link>
      </p>
      <h1>{group.name}</h1>
      <p style={{ color: '#555' }}>
        {locked ? '🔒 Predicciones bloqueadas.' : '🟢 Predicciones abiertas hasta'}{' '}
        {!locked && (
          <strong>
            {group.predictionsLockAt.toLocaleString('es-BO', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </strong>
        )}
      </p>
      <p>
        Código de invitación:{' '}
        <code style={{ background: '#eee', padding: '0.25rem 0.5rem', fontSize: '1.1rem' }}>
          {group.inviteCode}
        </code>{' '}
        ({leaderboard.length} {leaderboard.length === 1 ? 'jugador' : 'jugadores'})
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', margin: '1.5rem 0' }}>
        {!locked && (
          <Link href={`/groups/${slug}/predict`}>
            <button type="button" style={{ padding: '0.5rem 1rem' }}>
              {locked ? 'Ver mis predicciones' : 'Hacer / editar predicciones'}
            </button>
          </Link>
        )}
        <Link href={`/groups/${slug}/leaderboard`}>
          <button type="button" style={{ padding: '0.5rem 1rem' }}>
            Tabla de líderes
          </button>
        </Link>
      </div>

      {isOwner && <p style={{ color: '#999' }}>Eres el creador de este grupo.</p>}
    </main>
  )
}
