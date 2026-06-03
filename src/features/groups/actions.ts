'use server'

import { track } from '@vercel/analytics/server'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { groupMembers, groups, profiles } from '@/db/schema'
import {
  CATEGORY_DEFAULTS,
  CATEGORY_KEYS,
  type CategoryKey,
} from '@/features/predictions/category-defaults'
import { isSuperAdminEmail } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendNotificationByType } from '@/server/notifications/send'
import { generateInviteCode, slugify } from './helpers'

const QR_BUCKET = 'pool-qr'
const QR_MAX_BYTES = 5 * 1024 * 1024

// Best-effort QR upload right after group creation. Mirrors the validation in
// features/pool/storage.ts but inlined to avoid the redundant auth/owner
// check that helper does — the caller just inserted the group and knows the
// user is the owner. Failures here don't roll back the group; the owner can
// still upload later from Configurar pozo.
async function tryUploadPoolQrForNewGroup(groupId: string, file: File): Promise<string | null> {
  if (file.size === 0 || file.size > QR_MAX_BYTES) return null
  if (!file.type.startsWith('image/')) return null
  try {
    const admin = createSupabaseAdminClient()
    const { data: buckets } = await admin.storage.listBuckets()
    if (!buckets?.some((b) => b.name === QR_BUCKET)) {
      await admin.storage.createBucket(QR_BUCKET, {
        public: true,
        fileSizeLimit: QR_MAX_BYTES,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      })
    }
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
    const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'png'
    const path = `${groupId}/qr-${Date.now()}.${safeExt}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await admin.storage.from(QR_BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: false,
      cacheControl: '3600',
    })
    if (upErr) return null
    const { data: pub } = admin.storage.from(QR_BUCKET).getPublicUrl(path)
    return pub.publicUrl
  } catch (e) {
    console.error('new-group QR upload failed', e)
    return null
  }
}

const createGroupSchema = z.object({
  name: z.string().min(2).max(60),
  predictionsLockAt: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
  poolEnabled: z.boolean().optional(),
  poolCurrency: z.string().min(1).max(8).optional(),
  poolBuyInAmount: z.number().positive().max(9_999_999_999.99).optional(),
  poolPayoutRule: z.enum(['winner_takes_all', 'top_3_split', 'manual']).optional(),
})

const joinGroupSchema = z.object({
  inviteCode: z.string().min(4).max(12),
})

export type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string }

async function requireUserId(): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('not_authenticated')
  return user.id
}

// Scan the form for keys shaped `points:{categoryKey}=value`, validate against
// CATEGORY_KEYS and a 0-100 range, and produce a record of overrides. Unknown
// keys and out-of-range values are silently dropped so the create still
// succeeds with sensible fallbacks.
function parseCategoryPointOverrides(formData: FormData): Partial<Record<CategoryKey, number>> {
  const out: Partial<Record<CategoryKey, number>> = {}
  for (const [rawKey, rawValue] of formData.entries()) {
    if (!rawKey.startsWith('points:')) continue
    const key = rawKey.slice('points:'.length)
    if (!CATEGORY_KEYS.has(key as CategoryKey)) continue
    const value = typeof rawValue === 'string' ? Number.parseInt(rawValue, 10) : Number.NaN
    if (!Number.isFinite(value) || value < 0 || value > 100) continue
    out[key as CategoryKey] = value
  }
  return out
}

export async function createGroup(formData: FormData): Promise<ActionResult<{ slug: string }>> {
  const poolEnabled = formData.get('poolEnabled') === 'on'
  const rawBuyIn = formData.get('poolBuyInAmount')
  const buyInNum =
    typeof rawBuyIn === 'string' && rawBuyIn.length > 0 ? Number.parseFloat(rawBuyIn) : 100
  const pointOverrides = parseCategoryPointOverrides(formData)
  const parsed = createGroupSchema.safeParse({
    name: formData.get('name'),
    predictionsLockAt: formData.get('predictionsLockAt'),
    poolEnabled,
    poolCurrency: poolEnabled ? (formData.get('poolCurrency') ?? 'BOB') : undefined,
    poolBuyInAmount: poolEnabled ? buyInNum : undefined,
    poolPayoutRule: poolEnabled
      ? (formData.get('poolPayoutRule') ?? 'winner_takes_all')
      : undefined,
  })
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Nombre y fecha de bloqueo son requeridos.' }
  }

  let userId: string
  try {
    userId = await requireUserId()
  } catch {
    return { ok: false, error: 'Necesitas estar autenticado.' }
  }

  // Capability gate: only superadmins or users who were approved can create
  // groups. The home page UI hides the button for everyone else, this is the
  // defense-in-depth check against direct POSTs to the server action.
  const creatorProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, userId),
    columns: { canCreateGroups: true, email: true },
  })
  const creatorIsAdmin = creatorProfile?.email
    ? isSuperAdminEmail(creatorProfile.email)
    : false
  if (!creatorIsAdmin && !creatorProfile?.canCreateGroups) {
    return {
      ok: false,
      error: 'Aún no tienes permiso para crear grupos. Pide permiso primero desde el inicio.',
    }
  }

  const baseSlug = slugify(parsed.data.name) || 'grupo'
  let slug = baseSlug
  let suffix = 0
  // Avoid slug collisions with a small probe loop.
  // 5 attempts max is plenty for a small product.
  for (let i = 0; i < 5; i++) {
    const existing = await db.query.groups.findFirst({ where: eq(groups.slug, slug) })
    if (!existing) break
    suffix += 1
    slug = `${baseSlug}-${suffix}`
  }

  // 32^6 ≈ 1.07B codes, but we still probe before insert because the
  // invite_code column is UNIQUE and a clash would throw on commit.
  let inviteCode = generateInviteCode(6)
  for (let i = 0; i < 5; i++) {
    const existing = await db.query.groups.findFirst({
      where: eq(groups.inviteCode, inviteCode),
    })
    if (!existing) break
    inviteCode = generateInviteCode(6)
  }
  const lockAt = new Date(parsed.data.predictionsLockAt)

  const created = await db.transaction(async (tx) => {
    const [g] = await tx
      .insert(groups)
      .values({
        name: parsed.data.name,
        slug,
        inviteCode,
        createdBy: userId,
        predictionsLockAt: lockAt,
        poolEnabled: parsed.data.poolEnabled ?? false,
        poolCurrency: parsed.data.poolCurrency ?? null,
        poolBuyInAmount: (parsed.data.poolBuyInAmount ?? 100).toFixed(2),
        poolPayoutRule: parsed.data.poolPayoutRule ?? 'winner_takes_all',
      })
      .returning()

    await tx.insert(groupMembers).values({ groupId: g.id, userId, role: 'owner' })

    // Copy defaults from categories -> group_categories
    await tx.execute(sql`
      INSERT INTO group_categories (group_id, category_id, points, enabled)
      SELECT ${g.id}::uuid, id, default_points, true
      FROM categories
    `)

    // Apply per-category point overrides. Each row is a tiny UPDATE that joins
    // categories by key — small N (≤14) so the cost is acceptable inside the
    // same transaction.
    for (const [key, points] of Object.entries(pointOverrides)) {
      await tx.execute(sql`
        UPDATE group_categories
           SET points = ${points}
         WHERE group_id = ${g.id}::uuid
           AND category_id = (SELECT id FROM categories WHERE key = ${key})
      `)
    }

    return g
  })

  // Optional QR upload, only when the pool is on. Best-effort: a failure here
  // doesn't roll back the group, the owner can retry from Configurar pozo.
  if (parsed.data.poolEnabled) {
    const qrFile = formData.get('poolQr')
    if (qrFile instanceof File && qrFile.size > 0) {
      const url = await tryUploadPoolQrForNewGroup(created.id, qrFile)
      if (url) {
        await db.update(groups).set({ poolQrUrl: url }).where(eq(groups.id, created.id))
      }
    }
  }

  revalidatePath('/')
  after(() =>
    track('group_created', {
      poolEnabled: created.poolEnabled ?? false,
      poolCurrency: created.poolCurrency ?? 'none',
    }).catch((e) => console.error('analytics group_created failed', e)),
  )
  return { ok: true, data: { slug: created.slug } }
}

export async function joinGroup(formData: FormData): Promise<ActionResult<{ slug: string }>> {
  const parsed = joinGroupSchema.safeParse({
    inviteCode: (formData.get('inviteCode') ?? '').toString().toUpperCase().trim(),
  })
  if (!parsed.success) {
    return { ok: false, error: 'Código inválido.' }
  }

  let userId: string
  try {
    userId = await requireUserId()
  } catch {
    return { ok: false, error: 'Necesitas estar autenticado.' }
  }

  const group = await db.query.groups.findFirst({
    where: eq(groups.inviteCode, parsed.data.inviteCode),
  })
  if (!group) {
    return { ok: false, error: 'No encontramos un grupo con ese código.' }
  }

  const inserted = await db
    .insert(groupMembers)
    .values({ groupId: group.id, userId, role: 'member' })
    .onConflictDoNothing()
    .returning()

  revalidatePath('/')

  // Push notification + analytics run AFTER the response. Doing this inline
  // with `await` (as we used to) blocked the action by several seconds in
  // production while web-push hit external services like FCM/APNs — users
  // pressed the button multiple times thinking it had hung. `after()` keeps
  // the function execution alive on Vercel until these finish, but the
  // browser already got the redirect.
  if (inserted.length > 0) {
    after(async () => {
      try {
        await notifyOwnerOfNewMember(group.id, group.slug, group.name, userId)
      } catch (e) {
        console.error('member_joined notification failed', e)
      }
      try {
        await track('group_joined', { via: 'code' })
      } catch (e) {
        console.error('analytics group_joined failed', e)
      }
    })
  }
  return { ok: true, data: { slug: group.slug } }
}

async function notifyOwnerOfNewMember(
  groupId: string,
  groupSlug: string,
  groupName: string,
  newUserId: string,
): Promise<void> {
  // Recipients: owner + admin roles, excluding the joining user (defensive in
  // case they later get promoted to admin — though right now joins create
  // role=member so this is a no-op exclusion).
  const recipients = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        inArray(groupMembers.role, ['owner', 'admin']),
        ne(groupMembers.userId, newUserId),
      ),
    )
  if (recipients.length === 0) return
  const [joiner] = await db
    .select({ displayName: profiles.displayName, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, newUserId))
    .limit(1)
  if (!joiner) return
  await sendNotificationByType(
    'member_joined',
    recipients.map((r) => r.userId),
    {
      title: `👋 ${joiner.displayName} se unió a ${groupName}`,
      body: joiner.email ?? '',
      url: `/groups/${groupSlug}`,
      tag: `member-joined-${groupId}-${newUserId}`,
    },
  )
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  let userId: string
  try {
    userId = await requireUserId()
  } catch {
    return { ok: false, error: 'Necesitas estar autenticado.' }
  }

  // Admins (the creator) cannot leave (would orphan the group). UI shouldn't show the button.
  const membership = await db.query.groupMembers.findFirst({
    where: (gm, { and, eq: eqOp }) => and(eqOp(gm.groupId, groupId), eqOp(gm.userId, userId)),
  })
  if (!membership) return { ok: false, error: 'No eres miembro de este grupo.' }
  if (membership.role === 'owner') {
    return { ok: false, error: 'El admin del grupo no puede salir; debe eliminar el grupo.' }
  }

  await db
    .delete(groupMembers)
    .where(sql`group_id = ${groupId}::uuid AND user_id = ${userId}::uuid`)

  revalidatePath('/')
  return { ok: true }
}

export async function createGroupAndRedirect(formData: FormData): Promise<void> {
  const result = await createGroup(formData)
  if (!result.ok) throw new Error(result.error)
  redirect(`/groups/${result.data.slug}`)
}

export async function joinGroupAndRedirect(formData: FormData): Promise<void> {
  const result = await joinGroup(formData)
  if (!result.ok) throw new Error(result.error)
  redirect(`/groups/${result.data.slug}`)
}
