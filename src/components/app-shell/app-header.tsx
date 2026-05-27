import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'
import { Wordmark } from './wordmark'

type Props = {
  user: { name: string; email: string | null; avatarUrl: string | null }
  breadcrumb?: { label: string; href?: string }[]
}

// Last breadcrumb is the current page. Walk back from the previous one until
// we find an entry with an href — that's the natural "parent". If none, the
// user is one level below home, so back goes to "/".
function deriveBackHref(breadcrumb?: { label: string; href?: string }[]): string | null {
  if (!breadcrumb || breadcrumb.length === 0) return null
  const parents = breadcrumb.slice(0, -1)
  for (let i = parents.length - 1; i >= 0; i--) {
    const href = parents[i].href
    if (href) return href
  }
  return '/'
}

export function AppHeader({ user, breadcrumb }: Props) {
  const backHref = deriveBackHref(breadcrumb)
  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border bg-background/95 px-2 sm:px-8 backdrop-blur">
      <div className="flex items-center gap-1 sm:gap-3 min-w-0">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Volver"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        )}
        <Link href="/" className="shrink-0 px-1 sm:px-0">
          <Wordmark size="md" />
        </Link>
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            {breadcrumb.map((b, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: breadcrumb segments are stable per render
              <span key={`crumb-${i}-${b.label}`} className="flex items-center gap-2 min-w-0">
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                {b.href ? (
                  <Link href={b.href} className="hover:text-foreground truncate">
                    {b.label}
                  </Link>
                ) : (
                  <span className="truncate text-foreground">{b.label}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu name={user.name} email={user.email} avatarUrl={user.avatarUrl} />
      </div>
    </header>
  )
}
