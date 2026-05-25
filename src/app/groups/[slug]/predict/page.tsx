import { and, eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/db'
import { groupMembers, groups } from '@/db/schema'
import { getPredictionForm, listAllTeams } from '@/features/predictions/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PredictionForm } from './prediction-form'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export default async function PredictPage({ params }: Params) {
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

  const locked = new Date() >= group.predictionsLockAt
  const [form, allTeams] = await Promise.all([getPredictionForm(group.id, user.id), listAllTeams()])

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <p>
        <Link href={`/groups/${slug}`}>← {group.name}</Link>
      </p>
      <h1>Mis predicciones</h1>
      {locked && (
        <p style={{ color: 'crimson' }}>🔒 Las predicciones están bloqueadas. Solo modo lectura.</p>
      )}
      <PredictionForm
        groupSlug={slug}
        categories={form}
        teams={allTeams.map((t) => ({
          id: t.id,
          name: t.name,
          flagEmoji: t.flagEmoji,
          fifaCode: t.fifaCode,
        }))}
        locked={locked}
      />
    </main>
  )
}
