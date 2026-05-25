import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createGroupAndRedirect } from '@/features/groups/actions'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function NewGroupPage() {
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
      <h1>Crear grupo</h1>
      <form action={createGroupAndRedirect} style={{ display: 'grid', gap: '1rem' }}>
        <label>
          Nombre del grupo
          <input
            name="name"
            required
            minLength={2}
            maxLength={60}
            placeholder="Ej: Mundialistas BO"
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
          />
        </label>
        <label>
          Bloquear predicciones a partir de
          <input
            name="predictionsLockAt"
            type="datetime-local"
            required
            defaultValue="2026-06-11T17:00"
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
          />
          <small style={{ color: '#666' }}>
            Después de esta fecha nadie podrá editar predicciones. Sugerido: el inicio del partido
            inaugural.
          </small>
        </label>
        <button type="submit" style={{ padding: '0.75rem' }}>
          Crear grupo
        </button>
      </form>
    </main>
  )
}
