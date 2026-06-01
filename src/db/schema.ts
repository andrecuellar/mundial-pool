import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

export const memberRole = pgEnum('member_role', ['owner', 'admin', 'member'])

export const categoryValueKind = pgEnum('category_value_kind', ['team', 'player', 'team_set'])

export const payoutRule = pgEnum('payout_rule', ['winner_takes_all', 'top_3_split', 'manual'])

export const resolutionStrategy = pgEnum('resolution_strategy', [
  'final_winner',
  'final_loser',
  'third_place',
  'top_scorer_player',
  'top_assists_player',
  'top_scoring_team',
  'most_conceded_team',
  'finalists',
  'top_n_teams',
  'fifa_golden_ball',
  'fifa_golden_glove',
  'fifa_young_player',
  'revelation',
  'disappointment',
  'manual',
])

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  email: text('email'),
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const groups = pgTable('groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  inviteCode: text('invite_code').notNull().unique(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => profiles.id),
  predictionsLockAt: timestamp('predictions_lock_at', {
    withTimezone: true,
  }).notNull(),
  poolEnabled: boolean('pool_enabled').notNull().default(false),
  poolCurrency: text('pool_currency'),
  poolQrUrl: text('pool_qr_url'),
  poolPayoutRule: payoutRule('pool_payout_rule').notNull().default('winner_takes_all'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const poolTransactions = pgTable('pool_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  contributorUserId: uuid('contributor_user_id').references(() => profiles.id),
  contributorLabel: text('contributor_label'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  note: text('note'),
  createdByUserId: uuid('created_by_user_id')
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const groupMembers = pgTable(
  'group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: memberRole('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
)

export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').notNull().unique(),
  fifaCode: text('fifa_code'),
  name: text('name').notNull(),
  flagEmoji: text('flag_emoji'),
  badgeUrl: text('badge_url'),
  preTournamentChampionOdds: integer('pre_tournament_champion_odds'),
  expectedRound: integer('expected_round'),
  fifaRanking: integer('fifa_ranking'),
})

export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').unique(),
  fullName: text('full_name').notNull(),
  teamId: uuid('team_id').references(() => teams.id),
  position: text('position'),
  dateOfBirth: date('date_of_birth'),
})

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  valueKind: categoryValueKind('value_kind').notNull(),
  resolutionStrategy: resolutionStrategy('resolution_strategy').notNull(),
  defaultPoints: integer('default_points').notNull().default(1),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
})

export const groupCategories = pgTable(
  'group_categories',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    points: integer('points').notNull(),
    enabled: boolean('enabled').notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.categoryId] })],
)

export const predictions = pgTable(
  'predictions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    teamId: uuid('team_id').references(() => teams.id),
    playerId: uuid('player_id').references(() => players.id),
    playerText: text('player_text'),
    teamSet: jsonb('team_set').$type<string[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique('predictions_user_category_unique').on(t.groupId, t.userId, t.categoryId)],
)

export const results = pgTable('results', {
  categoryId: uuid('category_id')
    .primaryKey()
    .references(() => categories.id),
  teamId: uuid('team_id').references(() => teams.id),
  playerId: uuid('player_id').references(() => players.id),
  playerText: text('player_text'),
  teamSet: jsonb('team_set').$type<string[]>(),
  source: text('source').notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }).defaultNow().notNull(),
})

export const resolutionRuns = pgTable('resolution_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>(),
})

// Emoji reactions on individual predictions, post-lock. Limited to a fixed
// set of emojis on the UI side to avoid moderation. Stored as text so we can
// expand the set without a schema change.
export const predictionReactions = pgTable(
  'prediction_reactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    predictionId: uuid('prediction_id')
      .notNull()
      .references(() => predictions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique('prediction_reactions_unique').on(t.predictionId, t.userId, t.emoji)],
)

// Web Push subscriptions. One row per (user, browser/device) — the unique
// constraint is the endpoint URL the push service hands back. When sending
// returns 404/410 we delete the subscription as expired.
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique('push_subscriptions_endpoint_unique').on(t.userId, t.endpoint)],
)

// Tiny key/value table for app-wide global state that doesn't fit anywhere
// else. First user: persisting the magic-link rate-limit deadline so it's
// shared across devices, not local to a browser.
export const appState = pgTable('app_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Profile = typeof profiles.$inferSelect
export type Group = typeof groups.$inferSelect
export type GroupMember = typeof groupMembers.$inferSelect
export type Team = typeof teams.$inferSelect
export type Player = typeof players.$inferSelect
export type Category = typeof categories.$inferSelect
export type GroupCategory = typeof groupCategories.$inferSelect
export type Prediction = typeof predictions.$inferSelect
export type Result = typeof results.$inferSelect
export type PoolTransaction = typeof poolTransactions.$inferSelect
