import Link from 'next/link'
import { redirect } from 'next/navigation'
import { joinGroupAndRedirect } from '@/features/groups/actions'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function JoinGroupPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', fontFamily: 'sans-serif' }}>
      <p>
        <Link href="/">← Volver</Link>
      </p>
      <h1>Unirme a un grupo</h1>
      <form action={joinGroupAndRedirect} style={{ display: 'grid', gap: '1rem' }}>
        <label>
          Código de invitación
          <input
            name="inviteCode"
            required
            minLength={4}
            maxLength={12}
            placeholder="ABC123"
            style={{
              display: 'block',
              width: '100%',
              padding: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              fontSize: '1.25rem',
            }}
          />
        </label>
        <button type="submit" style={{ padding: '0.75rem' }}>
          Unirme
        </button>
      </form>
    </main>
  )
}
