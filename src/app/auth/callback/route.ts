import { NextResponse } from 'next/server'
import { upsertProfileFromAuth } from '@/features/auth/profile-sync'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? 'unknown')}`,
    )
  }

  try {
    await upsertProfileFromAuth(data.user)
  } catch (e) {
    console.error('profile upsert failed', e)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
