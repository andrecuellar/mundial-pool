import type { User } from '@supabase/supabase-js'
import { inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { env } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Allowlist of emails que pueden ver el panel /admin. Leemos de la env var
// SUPER_ADMIN_EMAILS (comma-separated, lowercased + trim). Nunca hardcoded
// en el código fuente — el repo es público y los emails no deben filtrarse.
// Si la env var está vacía o no seteada, el panel queda inaccesible para
// todos (404). Cualquiera que no esté en la lista también recibe 404 (no
// 403) para no exponer la existencia del panel.
export const SUPER_ADMIN_EMAILS: ReadonlySet<string> = new Set(
  (env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0),
)

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
