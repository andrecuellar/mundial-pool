import { NextResponse } from 'next/server'
import { syncPlayerStats } from '@/features/tournament/player-stats'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
// Mismo region pin que /api/cron/resolve: Supabase está en us-west-2 y
// queremos minimizar RTT del upsert en bulk.
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
    const result = await syncPlayerStats()
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
