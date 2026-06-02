'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { groupMembers, groups } from '@/db/schema'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const BUCKET = 'pool-qr'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

async function ensureBucket(): Promise<void> {
  const admin = createSupabaseAdminClient()
  const { data: buckets } = await admin.storage.listBuckets()
  if (buckets?.some((b) => b.name === BUCKET)) return
  await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  })
}

async function requireOwner(
  groupId: string,
): Promise<{ userId: string; slug: string } | { error: string }> {
  const ssr = await createSupabaseServerClient()
  const {
    data: { user },
  } = await ssr.auth.getUser()
  if (!user) return { error: 'No autenticado.' }
  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
  })
  if (!membership || membership.role !== 'owner') {
    return { error: 'Solo el admin del grupo puede subir el QR.' }
  }
  const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) })
  if (!group) return { error: 'Grupo no encontrado.' }
  return { userId: user.id, slug: group.slug }
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: string }

export async function uploadPoolQr(formData: FormData): Promise<UploadResult> {
  const groupId = formData.get('groupId')
  const file = formData.get('file')
  if (typeof groupId !== 'string' || !(file instanceof File)) {
    return { ok: false, error: 'Solicitud inválida.' }
  }
  if (file.size === 0) return { ok: false, error: 'Archivo vacío.' }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'Archivo muy grande (máx 5 MB).' }
  }
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'El archivo debe ser una imagen.' }
  }

  const auth = await requireOwner(groupId)
  if ('error' in auth) return { ok: false, error: auth.error }

  try {
    await ensureBucket()
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'No se pudo preparar el bucket.',
    }
  }

  const admin = createSupabaseAdminClient()
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'png'
  const path = `${groupId}/qr-${Date.now()}.${safeExt}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
    cacheControl: '3600',
  })
  if (upErr) return { ok: false, error: upErr.message }

  // Drop any previous QR(s) for this group. We do it after the new upload
  // succeeds so a failed replace can't leave the owner without a QR. The
  // folder layout is `{groupId}/qr-{ts}.{ext}`, so list the folder and
  // remove every entry except the one we just wrote. Best-effort: a failure
  // here only leaves orphan files behind, the new QR is already live.
  try {
    const { data: existing } = await admin.storage.from(BUCKET).list(groupId)
    const stale = (existing ?? [])
      .map((f) => `${groupId}/${f.name}`)
      .filter((p) => p !== path)
    if (stale.length > 0) {
      await admin.storage.from(BUCKET).remove(stale)
    }
  } catch (e) {
    console.error('cleanup of previous QR failed', e)
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
  await db.update(groups).set({ poolQrUrl: pub.publicUrl }).where(eq(groups.id, groupId))

  revalidatePath(`/groups/${auth.slug}`)
  revalidatePath(`/groups/${auth.slug}/admin/pool`)
  return { ok: true, url: pub.publicUrl }
}

export async function removePoolQr(groupId: string): Promise<UploadResult> {
  const auth = await requireOwner(groupId)
  if ('error' in auth) return { ok: false, error: auth.error }

  const admin = createSupabaseAdminClient()
  const { data: list } = await admin.storage.from(BUCKET).list(groupId)
  if (list && list.length > 0) {
    await admin.storage.from(BUCKET).remove(list.map((f) => `${groupId}/${f.name}`))
  }
  await db.update(groups).set({ poolQrUrl: null }).where(eq(groups.id, groupId))

  revalidatePath(`/groups/${auth.slug}`)
  revalidatePath(`/groups/${auth.slug}/admin/pool`)
  return { ok: true, url: '' }
}
