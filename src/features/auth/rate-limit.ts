import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { appState } from '@/db/schema'

// Single key for the magic-link cap. Stored as ISO timestamp.
const MAGIC_LINK_KEY = 'magic_link_blocked_until'

// Supabase's hourly cap on the built-in SMTP isn't documented; we wait out
// a full hour after the first 429 so we don't burn the next slot retrying.
export const MAGIC_LINK_BACKOFF_MS = 60 * 60 * 1000

export async function getMagicLinkBlockedUntil(): Promise<Date | null> {
  const row = await db.query.appState.findFirst({
    where: eq(appState.key, MAGIC_LINK_KEY),
  })
  if (!row) return null
  const ts = new Date(row.value)
  if (!Number.isFinite(ts.getTime())) return null
  return ts > new Date() ? ts : null
}

export async function setMagicLinkBlockedUntil(until: Date): Promise<void> {
  await db
    .insert(appState)
    .values({ key: MAGIC_LINK_KEY, value: until.toISOString() })
    .onConflictDoUpdate({
      target: appState.key,
      set: { value: until.toISOString(), updatedAt: new Date() },
    })
}
