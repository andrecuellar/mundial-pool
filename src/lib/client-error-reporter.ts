// Intercepts browser console.error/warn + unhandled errors and ships them
// to /api/client-errors so the superadmin can see runtime errors in
// /admin/errors without needing to open Sentry. Sentry stays active in
// parallel — this is the "fast, in-app" surface.
//
// Design notes:
// - We keep the original console.error/warn references so our own failures
//   never loop back through the patched method.
// - Client-side rate limit (30 events / 60s) caps runaway loops at the
//   source so we never DDoS our own endpoint.
// - Batched with a 1s debounce, max 20 events per POST.
// - keepalive=true so the final batch survives page navigation.

type Level = 'error' | 'warn' | 'uncaught' | 'unhandledrejection'

type ReportEvent = {
  level: Level
  message: string
  stack?: string
  url?: string
  ts: number
}

let queue: ReportEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let sent = 0
let windowStart = Date.now()
let installed = false
let origError: (...args: unknown[]) => void = () => {}

export function installClientErrorReporter(): void {
  if (typeof window === 'undefined' || installed) return
  installed = true

  origError = console.error.bind(console)
  const origWarn = console.warn.bind(console)

  console.error = (...args: unknown[]) => {
    try {
      enqueue('error', args)
    } catch {
      // never let reporter bugs break the host call
    }
    origError(...args)
  }
  console.warn = (...args: unknown[]) => {
    try {
      enqueue('warn', args)
    } catch {
      // ignore
    }
    origWarn(...args)
  }

  window.addEventListener('error', (e) => {
    try {
      const msg = e.message || (e.error instanceof Error ? e.error.message : String(e.error))
      const stack = e.error instanceof Error ? e.error.stack : undefined
      enqueue('uncaught', [msg], stack, e.filename || window.location.href)
    } catch {
      // ignore
    }
  })

  window.addEventListener('unhandledrejection', (e) => {
    try {
      const reason = e.reason
      const msg =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : safeStringify(reason)
      const stack = reason instanceof Error ? reason.stack : undefined
      enqueue('unhandledrejection', [msg], stack)
    } catch {
      // ignore
    }
  })
}

function enqueue(level: Level, args: unknown[], stack?: string, url?: string): void {
  const now = Date.now()
  if (now - windowStart > 60_000) {
    sent = 0
    windowStart = now
  }
  if (sent >= 30) return
  sent++

  const message = args.map(serializeArg).join(' ').slice(0, 2000)
  queue.push({
    level,
    message,
    stack: stack ? stack.slice(0, 4000) : undefined,
    url: (url ?? window.location.href).slice(0, 1000),
    ts: now,
  })

  if (!flushTimer) flushTimer = setTimeout(flush, 1000)
}

function serializeArg(a: unknown): string {
  if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack ?? ''}`
  if (typeof a === 'object' && a !== null) return safeStringify(a)
  return String(a)
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return '[unserializable]'
  }
}

async function flush(): Promise<void> {
  flushTimer = null
  if (queue.length === 0) return
  const batch = queue.splice(0, 20)
  try {
    await fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    })
  } catch (err) {
    // Use the ORIGINAL console.error to avoid recursing through our patched
    // version. Even so, we don't expect this to fire often in practice.
    try {
      origError('[client-error-reporter] flush failed', err)
    } catch {
      // ignore
    }
  }
}
