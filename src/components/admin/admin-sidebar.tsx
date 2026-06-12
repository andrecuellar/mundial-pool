'use client'

import {
  AlertTriangle,
  Database,
  Goal,
  Layers,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  UserCheck,
  User as UserIcon,
  Users,
  Vote,
  Wallet,
  Wrench,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/solicitudes', label: 'Solicitudes', icon: UserCheck },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { href: '/admin/grupos', label: 'Grupos', icon: Layers },
  { href: '/admin/predicciones', label: 'Predicciones', icon: Vote },
  { href: '/admin/jugadores', label: 'Jugadores', icon: Goal },
  { href: '/admin/pozos', label: 'Pozos', icon: Wallet },
  { href: '/admin/datos', label: 'Datos', icon: Database },
  { href: '/admin/notificar', label: 'Notificar', icon: Megaphone },
  { href: '/admin/errores', label: 'Errores', icon: AlertTriangle },
  { href: '/admin/sistema', label: 'Sistema', icon: Wrench },
]

export function AdminSidebar() {
  const pathname = usePathname() ?? ''

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col border-r border-warning/30 bg-warning/5 sm:top-16 sm:flex sm:h-[calc(100vh-4rem)]">
      <div className="border-b border-warning/30 px-4 py-3">
        <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-warning">
          <ShieldCheck className="h-3 w-3" />
          Modo superadmin
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
          Acceso completo a la data del sistema.
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {LINKS.map((l) => {
            const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
            const Icon = l.icon
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-warning/15 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{l.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-warning/30 p-2">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <UserIcon className="h-4 w-4 shrink-0" />
          Volver al modo jugador
        </Link>
      </div>
    </aside>
  )
}

// Mobile-only top nav since the sidebar hides under sm:.
export function AdminMobileNav() {
  const pathname = usePathname() ?? ''
  return (
    <nav className="sm:hidden -mx-4 mb-4 overflow-x-auto border-b border-warning/30 bg-warning/5">
      <ul className="flex min-w-max gap-1 px-4 py-2">
        {LINKS.map((l) => {
          const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-warning/15 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {l.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
