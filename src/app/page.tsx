import { redirect } from 'next/navigation'
import { signOut } from '@/features/auth/actions'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    'Player'

  return (
    <main style={{ maxWidth: 640, margin: '4rem auto', fontFamily: 'sans-serif' }}>
      <h1>mundial-pool</h1>
      <p>
        Sesión iniciada como <strong>{displayName}</strong> ({user.email}).
      </p>
      <p style={{ color: '#666' }}>
        UI de grupos y predicciones pendiente. Por ahora estás autenticado y tu perfil está
        sincronizado en la tabla <code>profiles</code>.
      </p>
      <form action={signOut}>
        <button type="submit" style={{ padding: '0.5rem 1rem', marginTop: '1rem' }}>
          Cerrar sesión
        </button>
      </form>
    </main>
  )
}
