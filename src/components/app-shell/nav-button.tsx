'use client'

import { Loader2 } from 'lucide-react'
import Link, { useLinkStatus } from 'next/link'
import type { ComponentProps } from 'react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { usePathname } from 'next/navigation'

type ButtonProps = ComponentProps<typeof Button>
type LinkProps = ComponentProps<typeof Link>

type NavButtonProps = Omit<ButtonProps, 'asChild' | 'onClick'> &
  Pick<LinkProps, 'href' | 'prefetch' | 'replace' | 'scroll'> & {
    /** Optional handler — runs before navigation (still guarded against double-fire). */
    onNavigate?: () => void
  }

// CTA button that navigates to a route. While the route is mounting it shows a
// spinner (via useLinkStatus) and blocks subsequent clicks so rapid taps don't
// stack navigations.
export function NavButton({
  href,
  prefetch,
  replace,
  scroll,
  onNavigate,
  children,
  disabled,
  ...buttonProps
}: NavButtonProps) {
  const pathname = usePathname()
  const clickedRef = useRef(false)

  // Re-arm when the page actually changes so the button works again on the
  // next page (the component may stay mounted in headers/back-links).
  useEffect(() => {
    clickedRef.current = false
  }, [pathname])

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (disabled) {
      e.preventDefault()
      return
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      // Let the browser handle modifier-clicks (open in new tab, etc).
      return
    }
    if (clickedRef.current) {
      e.preventDefault()
      return
    }
    clickedRef.current = true
    onNavigate?.()
  }

  return (
    <Button asChild disabled={disabled} {...buttonProps}>
      <Link
        href={href}
        prefetch={prefetch}
        replace={replace}
        scroll={scroll}
        onClick={handleClick}
      >
        <NavSpinner />
        {children}
      </Link>
    </Button>
  )
}

// Must be a descendant of the Link for useLinkStatus to attach.
function NavSpinner() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
}
