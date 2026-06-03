'use client'

import { AlertTriangle, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'mp:pool-disclaimer-collapsed'

type Props = { className?: string }

// Client wrapper around the 'home' variant of <PoolDisclaimer>. First-time
// visitors see the full text. Once they've seen it (per-device localStorage
// flag), the body collapses on subsequent visits and they can re-expand with
// the chevron. The toggle is always visible so the user can collapse it
// after reading, or expand it again later if they want a refresher.
export function PoolDisclaimerHome({ className }: Props) {
  // SSR renders expanded so first-time users see the full text without
  // waiting for hydration. The first useEffect tick may flip it to collapsed
  // for repeat visitors — a tiny flash, acceptable since the warning text
  // doesn't shift layout above it.
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === '1') setCollapsed(true)
  }, [])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    }
  }

  return (
    <div
      className={`rounded-xl border border-warning/30 bg-warning/5 text-xs leading-relaxed text-foreground ${className ?? ''}`}
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
        <ChevronDown
          aria-hidden
          className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            collapsed ? '' : 'rotate-180'
          }`}
        />
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 pl-[2.375rem] text-muted-foreground">
          <p>
            La app solo lleva el registro — el dinero lo manejan ustedes fuera de la app y el
            reparto lo hace cada administrador de grupo. Únete solo a grupos de gente que conozcas.
            No nos hacemos responsables por pérdidas, fraudes o disputas entre miembros.
          </p>
        </div>
      )}
    </div>
  )
}
