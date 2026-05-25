import { and, eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/db'
import { categories, groupCategories, groupMembers, groups } from '@/db/schema'
import { getLeaderboard } from '@/features/scoring/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export default async function LeaderboardPage({ params }: Params) {
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
  if (!membership) redirect(`/groups/${slug}`)

  const [leaderboard, cats] = await Promise.all([
    getLeaderboard(group.id),
    db
      .select({
        id: categories.id,
        name: categories.name,
        key: categories.key,
        points: groupCategories.points,
      })
      .from(categories)
      .innerJoin(groupCategories, eq(groupCategories.categoryId, categories.id))
      .where(and(eq(groupCategories.groupId, group.id), eq(groupCategories.enabled, true))),
  ])

  return (
    <main style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <p>
        <Link href={`/groups/${slug}`}>← {group.name}</Link>
      </p>
      <h1>Tabla de líderes</h1>

      {leaderboard.length === 0 ? (
        <p>Todavía no hay jugadores en este grupo.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>#</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Jugador</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Total</th>
              {cats.map((c) => (
                <th
                  key={c.id}
                  style={{ textAlign: 'right', padding: '0.5rem', fontSize: '0.75rem' }}
                  title={c.name}
                >
                  {c.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((row, i) => (
              <tr
                key={row.userId}
                style={{
                  borderBottom: '1px solid #eee',
                  background: row.userId === user.id ? '#fffbe6' : 'transparent',
                }}
              >
                <td style={{ padding: '0.5rem' }}>{i + 1}</td>
                <td style={{ padding: '0.5rem' }}>{row.displayName}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>
                  {row.totalPoints}
                </td>
                {cats.map((c) => (
                  <td
                    key={c.id}
                    style={{
                      padding: '0.5rem',
                      textAlign: 'right',
                      fontSize: '0.85rem',
                      color: (row.breakdown[c.id] ?? 0) > 0 ? '#0a0' : '#aaa',
                    }}
                  >
                    {row.breakdown[c.id] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ color: '#666', marginTop: '2rem', fontSize: '0.85rem' }}>
        Los puntos se recalculan automáticamente cuando el cron de resolución actualiza los
        resultados.
      </p>
    </main>
  )
}
