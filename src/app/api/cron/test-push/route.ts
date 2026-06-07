import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { env } from '@/lib/env'
import { sendPushToUser } from '@/server/notifications/send'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30
export const preferredRegion = 'sfo1'

// Endpoint manual para mandar un push de prueba a un user específico.
// Bearer-gated como los demás crons. Útil para debugging.
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
  const url = new URL(req.url)
  const email = url.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'missing email param' }, { status: 400 })

  const userRows = await db
    .select({ id: profiles.id, name: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.email, email.toLowerCase()))
    .limit(1)
  if (userRows.length === 0) {
    return NextResponse.json({ error: 'user not found', email }, { status: 404 })
  }
  const user = userRows[0]

  const result = await sendPushToUser(user.id, {
    title: '🏆 Prueba de notificación',
    body: 'Si ves esto, las push notifications funcionan correctamente.',
    url: '/',
    tag: `test-push-${Date.now()}`,
  })

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, email },
    sent: result.sent,
    failed: result.failed,
  })
}

export const GET = handle
export const POST = handle
