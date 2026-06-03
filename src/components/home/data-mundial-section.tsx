'use client'

import { ChevronDown, ChevronRight, Database } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

// Collapsible 'Datos del Mundial 2026' section for the home page. Mobile
// defaults closed to keep the page light; desktop (lg breakpoint and up)
// defaults open since there's plenty of vertical room and the section is
// useful at-a-glance. The expand affordance stays explicit on both so the
// user can collapse on desktop too.
export function DataMundialSection() {
  // SSR + first mobile paint: closed. On client mount we flip to open if
  // the viewport is desktop. Brief flash on desktop is acceptable.
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 1024px)')
    if (mq.matches) setOpen(true)
  }, [])

  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium">Datos del Mundial 2026</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {open ? 'Ocultar' : 'Ver más'}
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      <div
        aria-hidden={!open}
        className={`grid motion-safe:transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className={`min-h-0 overflow-hidden ${open ? '' : 'pointer-events-none'}`}>
          <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2">
            <Link
              href="/torneo/selecciones"
              tabIndex={open ? 0 : -1}
              className="hover-lift group flex items-start gap-3 rounded-lg border border-border bg-background p-4"
            >
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Tabla de las 48 selecciones</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Ranking 1→48 con desempates por penales, fair play y diferencia de gol.
                </p>
              </div>
            </Link>
            <Link
              href="/torneo/jugadores"
              tabIndex={open ? 0 : -1}
              className="hover-lift group flex items-start gap-3 rounded-lg border border-border bg-background p-4"
            >
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Goleadores y asistentes</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Top scorers y máximos asistentes según FIFA. Qué cuenta y qué no.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
