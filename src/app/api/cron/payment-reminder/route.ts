import { and, eq, gt } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { groupMembers, groups } from '@/db/schema'
import { env } from '@/lib/env'
import { sendNotificationByType } from '@/server/notifications/send'
import { resolveAudience } from '@/features/notifications/audience'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = 'sfo1'

function isAuthorized(req: Request): boolean {
  const secret = env.CRON_SECRET ?? env.RESOLUTION_CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization')
  return header === `Bearer ${secret}`
}

// Escalada: 7, 3 y 1 días antes del cierre. Cron corre diario, así que
// dentro de cada ventana de 24h cada grupo cae en máximo uno de los
// buckets. Si una vez por error el cron no corre un día, perdemos ese
// toque — no re-enviamos retroactivamente para evitar spam.
type Stage = { days: 1 | 3 | 7; tone: 'urgent' | 'reminder' | 'first' }
function stageForDays(d: number): Stage | null {
  if (d === 1) return { days: 1, tone: 'urgent' }
  if (d === 3) return { days: 3, tone: 'reminder' }
  if (d === 7) return { days: 7, tone: 'first' }
  return null
}

function copyForStage(groupName: string, stage: Stage): { title: string; body: string } {
  if (stage.tone === 'first') {
    return {
      title: '💰 Falta tu aporte al pozo',
      body: `Quedan 7 días para el cierre. Aporta a tu pozo de "${groupName}" cuando puedas.`,
    }
  }
  if (stage.tone === 'reminder') {
    return {
      title: '⚠️ Tu aporte sigue pendiente',
      body: `El cierre de "${groupName}" es en 3 días — todavía no apareces como contribuyente.`,
    }
  }
  return {
    title: '🚨 Último día para aportar',
    body: `Hoy es el último día para aportar al pozo de "${groupName}". Avisa al admin cuando hagas la transferencia.`,
  }
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const summary: { groupId: string; groupSlug: string; stage: number; usersNotified: number }[] =
    []

  // Pull todos los grupos con pozo activo y lock futuro.
  const candidateGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      slug: groups.slug,
      predictionsLockAt: groups.predictionsLockAt,
    })
    .from(groups)
    .where(and(eq(groups.poolEnabled, true), gt(groups.predictionsLockAt, new Date(now))))

  for (const g of candidateGroups) {
    const msUntilLock = g.predictionsLockAt.getTime() - now
    const daysUntilLock = Math.ceil(msUntilLock / (24 * 60 * 60 * 1000))
    const stage = stageForDays(daysUntilLock)
    if (!stage) continue

    // ¿Tiene miembros el grupo? (corto-circuito barato)
    const [hasAnyMember] = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, g.id))
      .limit(1)
    if (!hasAnyMember) continue

    // Reusa la misma lógica de audiencia del broadcast admin para no
    // duplicar el query del LEFT JOIN poolTransactions.
    const audience = await resolveAudience({ kind: 'non_payers', groupId: g.id })
    if (audience.userIds.length === 0) continue

    const copy = copyForStage(g.name, stage)
    await sendNotificationByType('payment_reminder', audience.userIds, {
      title: copy.title,
      body: copy.body,
      url: `/groups/${g.slug}#pozo`,
      tag: `payment-reminder-${stage.days}d-${g.id}`,
    })
    summary.push({
      groupId: g.id,
      groupSlug: g.slug,
      stage: stage.days,
      usersNotified: audience.userIds.length,
    })
  }

  return NextResponse.json({
    ok: true,
    candidateGroups: candidateGroups.length,
    notifications: summary,
  })
}

export const GET = handle
export const POST = handle
