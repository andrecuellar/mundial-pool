import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      // setAll runs when Supabase rotates the access/refresh token mid-request.
      // It throws when called from a Server Component (Next.js disallows
      // mutating cookies outside Server Actions / Route Handlers). Swallowing
      // is the documented Supabase SSR pattern — the bad cookies stay around
      // for that one render, but the next call (action / route handler) gets
      // the refreshed token. Without this, the throw bubbles up as an
      // unhandled error and crashes the page render.
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Component context — ignore.
        }
      },
    },
  })
}
