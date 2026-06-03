'use client'

import { AlertTriangle, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'mp:pool-disclaimer-seen'

type Props = { className?: string }

// Client wrapper around the 'home' variant of <PoolDisclaimer>. First-time
// visitors see the full text. The flag flips to "seen" on the first mount,
// so every subsequent visit (this device) starts collapsed. The user can
// expand again any time to refresh memory; the next visit will collapse
// it again — we treat the warning as "shown once, then ambient".
export function PoolDisclaimerHome({ className }: Props) {
  // SSR renders expanded so first-time users see the full text without
  // waiting for hydration. The first useEffect tick may flip it to collapsed
  // for repeat visitors — a tiny flash, acceptable since the warning text
  // doesn't shift layout above it.
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = window.localStorage.getItem(STORAGE_KEY)
    if (seen === '1') {
      setCollapsed(true)
    } else {
      // First visit: leave expanded so they read it, but mark as seen so
      // the next visit lands collapsed.
      window.localStorage.setItem(STORAGE_KEY, '1')
    }
  }, [])

  // Toggle is local-only: we don't overwrite the "seen" flag, so re-expanding
  // is temporary (next visit goes back to collapsed by default).
  function toggle() {
    setCollapsed((c) => !c)
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border border-warning/30 bg-warning/5 text-xs leading-relaxed text-foreground ${className ?? ''}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="flex w-full items-start gap-2.5 px-4 py-3 text-left"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span className="min-w-0 flex-1 font-medium">
          Esto es un pool entre amigos. No es una casa de apuestas.
        </span>
        <span className="mt-0.5 flex shrink-0 items-center gap-1.5 text-[11px] font-normal text-muted-foreground">
          {collapsed ? 'Ver más' : 'Ocultar'}
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 transition-transform duration-300 ${
              collapsed ? '' : 'rotate-180'
            }`}
          />
        </span>
      </button>
      <div
        aria-hidden={collapsed}
        className={`grid motion-safe:transition-[grid-template-rows,opacity] duration-300 ease-out ${
          collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
        }`}
      >
        <div className={`min-h-0 overflow-hidden ${collapsed ? 'pointer-events-none' : ''}`}>
          <div className="px-4 pb-3 pl-[2.375rem] text-muted-foreground">
            <p>
              La app solo lleva el registro — el dinero lo manejan ustedes fuera de la app y el
              reparto lo hace cada administrador de grupo. Únete solo a grupos de gente que conozcas.
              No nos hacemos responsables por pérdidas, fraudes o disputas entre miembros.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
