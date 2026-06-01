import { createServerClient } from '@supabase/ssr'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { clientEnv } from '@/lib/env.client'

// Paths a banned user is still allowed to reach. Without these, the ban
// redirect loops forever (the /banned page itself, the sign-out POST and
// auth callbacks).
const BAN_ALLOWLIST = ['/banned', '/login', '/auth/']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const path = request.nextUrl.pathname
    const exempt = BAN_ALLOWLIST.some((p) => path === p || path.startsWith(p))
    if (!exempt) {
      const rows = await db
        .select({ bannedAt: profiles.bannedAt })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)
      if (rows[0]?.bannedAt) {
        return NextResponse.redirect(new URL('/banned', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
