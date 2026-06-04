import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { clientErrors } from '@/db/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const Body = z.object({
  events: z
    .array(
      z.object({
        level: z.enum(['error', 'warn', 'uncaught', 'unhandledrejection']),
        message: z.string().min(1).max(2000),
        stack: z.string().max(4000).optional(),
        url: z.string().max(1000).optional(),
        ts: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1)
    .max(20),
})

// Per-IP rate limit kept in module scope. Defensive against runaway client
// loops, not coordinated abuse — Fluid Compute reuses instances enough that a
// burst from one IP usually hits the same Lambda. Slight over-count across
// instances is acceptable.
type Bucket = { count: number; windowStart: number }
const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 30

function getIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function checkRateLimit(ip: string, eventCount: number): boolean {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > 5 * WINDOW_MS) buckets.delete(key)
  }
  const cur = buckets.get(ip)
  if (!cur || now - cur.windowStart > WINDOW_MS) {
    buckets.set(ip, { count: eventCount, windowStart: now })
    return true
  }
  if (cur.count + eventCount > MAX_PER_WINDOW) return false
  cur.count += eventCount
  return true
}

function fingerprint(message: string, stack: string | undefined): string {
  const firstStackLine = stack ? stack.split('\n')[1]?.trim() ?? '' : ''
  return createHash('sha256').update(`${message}\n${firstStackLine}`).digest('hex').slice(0, 32)
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null)
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const ip = getIp(req)
  if (!checkRateLimit(ip, parsed.data.events.length)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  // Attempt to attribute the events to a user, but don't block if there's no
  // session — blanks happen on /login where there's no auth yet.
  let userId: string | null = null
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    userId = null
  }

  const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 500) || null

  await db.insert(clientErrors).values(
    parsed.data.events.map((e) => ({
      userId,
      level: e.level,
      message: e.message,
      stack: e.stack ?? null,
      url: e.url ?? null,
      userAgent,
      fingerprint: fingerprint(e.message, e.stack),
    })),
  )

  return new NextResponse(null, { status: 204 })
}
