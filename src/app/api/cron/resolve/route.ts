import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { runResolution } from '@/server/resolution'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function isAuthorized(req: Request): boolean {
  if (!env.RESOLUTION_CRON_SECRET) return false
  const header = req.headers.get('authorization')
  return header === `Bearer ${env.RESOLUTION_CRON_SECRET}`
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
