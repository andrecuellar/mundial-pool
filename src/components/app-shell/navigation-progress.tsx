'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'

const TRICKLE_INTERVAL_MS = 250
const TRICKLE_INCREMENT = 5 // % per tick
const TRICKLE_CAP = 80 // bar never exceeds this without route change
const FINISH_DURATION_MS = 180
const FADE_DURATION_MS = 200
const SAFETY_TIMEOUT_MS = 8000

type Phase = 'idle' | 'active' | 'finishing'

function isSameOriginNavigableAnchor(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const anchor = target.closest('a')
  if (!anchor) return false
  const href = anchor.getAttribute('href')
  if (!href) return false
  if (anchor.hasAttribute('download')) return false
  const targetAttr = anchor.getAttribute('target')
  if (targetAttr && targetAttr !== '_self') return false
  // External absolute URLs (http(s)://other.host/...) → not internal nav.
  try {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return false
    // Same path + same query + same hash → no navigation will happen.
    if (
      url.pathname === window.location.pathname &&
      url.search === window.location.search &&
      url.hash === window.location.hash
    ) {
      return false
    }
  } catch {
    return false
  }
  return true
}

function NavigationProgressInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  const trickleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track whether the latest pathname change came after a click — distinguishes
  // user-initiated nav from the initial mount.
  const armedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function clearTimers() {
    if (trickleTimerRef.current) {
      clearInterval(trickleTimerRef.current)
      trickleTimerRef.current = null
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current)
      safetyTimerRef.current = null
    }
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current)
      finishTimerRef.current = null
    }
  }

  function start() {
    armedRef.current = true
    clearTimers()
    setPhase('active')
    if (prefersReducedMotion) {
      setProgress(80)
    } else {
      setProgress(8)
      trickleTimerRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= TRICKLE_CAP) return p
          // Slow down as it approaches the cap — feels less linear.
          const remaining = TRICKLE_CAP - p
          const step = Math.max(0.5, (remaining / TRICKLE_CAP) * TRICKLE_INCREMENT)
          return Math.min(TRICKLE_CAP, p + step)
        })
      }, TRICKLE_INTERVAL_MS)
    }
    safetyTimerRef.current = setTimeout(() => {
      finish()
    }, SAFETY_TIMEOUT_MS)
  }

  function finish() {
    if (!armedRef.current) return
    armedRef.current = false
    clearTimers()
    setPhase('finishing')
    setProgress(100)
    finishTimerRef.current = setTimeout(() => {
      setPhase('idle')
      setProgress(0)
    }, FINISH_DURATION_MS + FADE_DURATION_MS)
  }

  // Listen for clicks on internal links. Delegated so we don't need to wrap
  // every Link in the codebase.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return
      if (e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      if (!isSameOriginNavigableAnchor(e.target)) return
      start()
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
    // start() reads `prefersReducedMotion` from closure; we re-attach when it
    // changes so the new value is used.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion])

  // When the route actually changes, finish the bar. armedRef gate prevents
  // firing on initial mount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: react to route change
  useEffect(() => {
    finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  useEffect(() => clearTimers, [])

  if (phase === 'idle') return null

  const opacity = phase === 'finishing' ? 0 : 1

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 right-0 z-[60] h-0.5"
      style={{ opacity, transition: `opacity ${FADE_DURATION_MS}ms ease-out` }}
    >
      <div
        className="h-full bg-primary shadow-[0_0_10px_rgba(0,0,0,0.3)] origin-left"
        style={{
          transform: `scaleX(${progress / 100})`,
          transition: prefersReducedMotion
            ? 'none'
            : phase === 'finishing'
              ? `transform ${FINISH_DURATION_MS}ms ease-out`
              : 'transform 220ms ease-out',
        }}
      />
    </div>
  )
}

export function NavigationProgress() {
  // useSearchParams() bails to client-rendering — wrap in Suspense so it
  // doesn't escalate the whole layout.
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  )
}
