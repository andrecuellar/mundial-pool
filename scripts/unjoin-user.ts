// One-off: remove a single user from any group(s) they belong to so they can
// re-join cleanly. This is NOT a ban — auth + profile stay, only the group
// membership rows go (which cascades to predictions and reactions for the
// same user+group, since predictions FK to both).
//
// Dry-run by default. Pass --apply to actually delete.
//
// Usage:
//   pnpm dlx tsx scripts/unjoin-user.ts urriolagoitiadaniel@gmail.com
//   pnpm dlx tsx scripts/unjoin-user.ts urriolagoitiadaniel@gmail.com --apply
import { config } from 'dotenv'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../src/db/schema'

const {
  groupMembers,
  groups,
  poolTransactions,
  predictionReactions,
  predictions,
  profiles,
} = schema

config({ path: '.env.local' })
config({ path: '.env' })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const [emailArg, ...rest] = process.argv.slice(2)
if (!emailArg) {
  console.error('Usage: tsx scripts/unjoin-user.ts <email> [--apply]')
  process.exit(1)
}
const apply = rest.includes('--apply')

const client = postgres(databaseUrl, { prepare: false })
const db = drizzle(client, { schema })

async function main() {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.email, emailArg),
    columns: { id: true, email: true, displayName: true },
  })
  if (!profile) {
    console.error(`No profile found for email ${emailArg}`)
    process.exit(1)
  }
  console.info(`User: ${profile.email} (${profile.displayName ?? '—'}) id=${profile.id}`)

  const memberships = await db
    .select({
      groupId: groups.id,
      groupName: groups.name,
      groupSlug: groups.slug,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, profile.id))

  if (memberships.length === 0) {
    console.info('No group memberships. Nothing to do.')
    await client.end()
    return
  }

  console.info('\nMemberships:')
  console.table(memberships)

  const groupIds = memberships.map((m) => m.groupId)

  const [predCount] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(predictions)
    .where(and(inArray(predictions.groupId, groupIds), eq(predictions.userId, profile.id)))
  const [reactCount] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(predictionReactions)
    .where(eq(predictionReactions.userId, profile.id))
  const [poolCount] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(poolTransactions)
    .where(
      and(
        inArray(poolTransactions.groupId, groupIds),
        eq(poolTransactions.contributorUserId, profile.id),
      ),
    )

  console.info('\nWill remove (per group above):')
  console.table({
    group_members_rows: memberships.length,
    predictions_rows: predCount.n,
    prediction_reactions_rows: reactCount.n,
    pool_transactions_rows: poolCount.n,
  })

  if (!apply) {
    console.info('\nDRY RUN. Pass --apply to actually delete.')
    await client.end()
    return
  }

  console.info('\nApplying…')
  await db.transaction(async (tx) => {
    // Predictions FK to (groupId, userId) — delete those first so the membership
    // delete doesn't leave orphans (predictions also cascade from groups, but
    // we're not deleting the group, just the user's row inside it).
    await tx
      .delete(predictions)
      .where(and(inArray(predictions.groupId, groupIds), eq(predictions.userId, profile.id)))
    await tx
      .delete(predictionReactions)
      .where(eq(predictionReactions.userId, profile.id))
    await tx
      .delete(poolTransactions)
      .where(
        and(
          inArray(poolTransactions.groupId, groupIds),
          eq(poolTransactions.contributorUserId, profile.id),
        ),
      )
    await tx.delete(groupMembers).where(eq(groupMembers.userId, profile.id))
  })
  console.info('Done. User can re-join via invite code.')

  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
