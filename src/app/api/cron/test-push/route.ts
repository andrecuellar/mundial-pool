import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { sendPushToUser } from '@/server/notifications/send'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30
export const preferredRegion = 'sfo1'

// Endpoint manual para mandar un push de prueba a un user específico.
// Hardcodeado a un único email (el del superadmin) para que no requiera
// auth — cualquier petición a otro email se rechaza.
const ALLOWED_EMAIL = 'acuellaravaroma@gmail.com'

async function handle(req: Request) {
  const url = new URL(req.url)
  const email = (url.searchParams.get('email') ?? '').toLowerCase()
  if (email !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: 'not allowed' }, { status: 403 })
  }

  const userRows = await db
    .select({ id: profiles.id, name: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.email, ALLOWED_EMAIL))
    .limit(1)
  if (userRows.length === 0) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 })
  }
  const user = userRows[0]

  const result = await sendPushToUser(user.id, {
    title: '🏆 Prueba de notificación',
    body: 'Si ves esto, las push notifications de mundial-pool funcionan.',
    url: '/',
    tag: `test-push-${Date.now()}`,
  })

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name },
    sent: result.sent,
    failed: result.failed,
  })
}

export const GET = handle
export const POST = handle
