import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { runResolution } from '@/server/resolution'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
// Supabase DB is in us-west-2 (Oregon). Pinning the cron to sfo1 keeps the
// chatty resolution flow (read predictions → compute → write results → notify)
// inside the same region, cutting per-query RTT from ~80ms to ~10ms.
export const preferredRegion = 'sfo1'

function isAuthorized(req: Request): boolean {
  const secret = env.CRON_SECRET ?? env.RESOLUTION_CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization')
  return header === `Bearer ${secret}`
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const result = await runResolution()
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
