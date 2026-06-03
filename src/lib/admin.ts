import type { User } from '@supabase/supabase-js'
import { inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { profiles } from '@/db/schema'
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

/**
 * Resolves the `profiles.id` of every superadmin by looking up their emails
 * in the profiles table. Used to broadcast notifications (group-creation
 * requests, future moderation alerts) to all admins.
 */
export async function getSuperAdminUserIds(): Promise<string[]> {
  const emails = Array.from(SUPER_ADMIN_EMAILS)
  if (emails.length === 0) return []
  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(inArray(profiles.email, emails))
  return rows.map((r) => r.id)
}
