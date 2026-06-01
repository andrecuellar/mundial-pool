import type * as React from 'react'
import { AdminMobileNav, AdminSidebar } from '@/components/admin/admin-sidebar'
import { AppHeader } from '@/components/app-shell/app-header'
import { requireSuperAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Single guard for the whole panel. If the user isn't an admin this calls
  // notFound() and nothing below runs.
  const user = await requireSuperAdmin()

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    'Admin'
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null

  return (
    <>
      <AppHeader
        user={{ name: displayName, email: user.email ?? null, avatarUrl }}
        breadcrumb={[{ label: 'Superadmin' }]}
      />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <AdminMobileNav />
          {children}
        </main>
      </div>
    </>
  )
}
