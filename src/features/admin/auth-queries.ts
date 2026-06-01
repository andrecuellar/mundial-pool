import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type AuthUserSummary = {
  id: string
  email: string | null
  provider: string | null
  lastSignInAt: Date | null
  createdAt: Date | null
  emailConfirmedAt: Date | null
}

/**
 * Lists all auth.users via the Supabase admin API. Service-role only, so this
 * file is server-only-guarded. Limited to first 1000 users (pagination not
 * needed at our scale yet).
 */
export async function listAuthUsers(): Promise<AuthUserSummary[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(`auth.admin.listUsers failed: ${error.message}`)
  return data.users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    provider: u.app_metadata?.provider ?? null,
    lastSignInAt: u.last_sign_in_at ? new Date(u.last_sign_in_at) : null,
    createdAt: u.created_at ? new Date(u.created_at) : null,
    emailConfirmedAt: u.email_confirmed_at ? new Date(u.email_confirmed_at) : null,
  }))
}

export async function getAuthUser(userId: string): Promise<AuthUserSummary | null> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) {
    // If the user wasn't found, getUserById returns an error with status 404.
    if (error.status === 404) return null
    throw new Error(`auth.admin.getUserById failed: ${error.message}`)
  }
  const u = data.user
  return {
    id: u.id,
    email: u.email ?? null,
    provider: u.app_metadata?.provider ?? null,
    lastSignInAt: u.last_sign_in_at ? new Date(u.last_sign_in_at) : null,
    createdAt: u.created_at ? new Date(u.created_at) : null,
    emailConfirmedAt: u.email_confirmed_at ? new Date(u.email_confirmed_at) : null,
  }
}
