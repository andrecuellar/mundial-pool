import type { User } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Allowlist of emails that get the /admin panel. Everyone else gets a 404
// (not 403) so non-admins can't discover that the panel exists.
export const SUPER_ADMIN_EMAILS: ReadonlySet<string> = new Set(['acuellaravaroma@gmail.com'])

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.has(email.toLowerCase())
}

export function isSuperAdmin(user: User | null | undefined): boolean {
  return isSuperAdminEmail(user?.email)
}

/**
 * Server-only guard for every page under /admin. Calls notFound() if the
 * caller isn't an admin — that keeps the panel invisible to outsiders.
 */
export async function requireSuperAdmin(): Promise<User> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isSuperAdmin(user)) {
    notFound()
  }
  // notFound throws — we only reach here when user is non-null.
  return user as User
}
