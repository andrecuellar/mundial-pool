import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { groupMembers, groups } from '@/db/schema'
import { signOut } from '@/features/auth/actions'
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
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, user.id))
    .orderBy(desc(groups.createdAt))

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    'Player'

  return (
    <main
      style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'sans-serif', padding: '0 1rem' }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>mundial-pool</h1>
          <p style={{ margin: 0, color: '#666' }}>Hola, {displayName}.</p>
        </div>
        <form action={signOut}>
          <button type="submit" style={{ padding: '0.4rem 0.8rem' }}>
            Cerrar sesión
          </button>
        </form>
      </header>

      <section style={{ marginTop: '2rem' }}>
        <h2>Mis grupos</h2>
        {myGroups.length === 0 ? (
          <p style={{ color: '#666' }}>Todavía no estás en ningún grupo.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {myGroups.map((g) => {
              const locked = new Date() >= g.predictionsLockAt
              return (
                <li
                  key={g.id}
                  style={{ border: '1px solid #ddd', padding: '0.75rem', marginBottom: '0.5rem' }}
                >
                  <Link
                    href={`/groups/${g.slug}`}
                    style={{ fontSize: '1.1rem', fontWeight: 'bold' }}
                  >
                    {g.name}
                  </Link>{' '}
                  {g.role === 'owner' && (
                    <span style={{ fontSize: '0.75rem', color: '#888' }}>· owner</span>
                  )}
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>
                    {locked
                      ? '🔒 Predicciones bloqueadas'
                      : `🟢 Predicciones abiertas hasta ${g.predictionsLockAt.toLocaleDateString('es-BO')}`}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <Link href="/groups/new">
            <button type="button" style={{ padding: '0.5rem 1rem' }}>
              Crear grupo
            </button>
          </Link>
          <Link href="/groups/join">
            <button type="button" style={{ padding: '0.5rem 1rem' }}>
              Unirme con código
            </button>
          </Link>
        </div>
      </section>
    </main>
  )
}
