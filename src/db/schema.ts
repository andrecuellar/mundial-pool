import {
  boolean,
  date,
  index,
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

export const matchStage = pgEnum('match_stage', [
  'group',
  'r32',
  'r16',
  'qf',
  'sf',
  'third_place',
  'final',
])

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
  bannedAt: timestamp('banned_at', { withTimezone: true }),
  bannedReason: text('banned_reason'),
  bannedByUserId: uuid('banned_by_user_id'),
  // Group creation is gated by superadmin approval. Default false; flipped to
  // true once the user is granted via the request flow (or grandfathered via
  // the migration for users who already created groups before this gate).
  canCreateGroups: boolean('can_create_groups').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// Audit log of group-creation permission requests. One pending row per user
// (enforced via a partial unique index, see migration). Approved/rejected
// rows are kept for history.
export const groupCreationRequests = pgTable(
  'group_creation_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    message: text('message'),
    status: text('status').notNull().default('pending'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => profiles.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_gcr_status').on(t.status),
    index('idx_gcr_user').on(t.userId),
  ],
)

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
  poolBuyInAmount: numeric('pool_buy_in_amount', { precision: 12, scale: 2 })
    .notNull()
    .default('100.00'),
  poolQrUrl: text('pool_qr_url'),
  poolPayoutRule: payoutRule('pool_payout_rule').notNull().default('winner_takes_all'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const poolTransactions = pgTable(
  'pool_transactions',
  {
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
  },
  (t) => [index('idx_pool_tx_group_user').on(t.groupId, t.contributorUserId)],
)

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
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index('idx_group_members_user').on(t.userId),
  ],
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
  // Tournament state — populated by the daily cron from the football provider.
  // All nullable / zero-default so pre-Mundial the existing UI still works.
  reachedRound: text('reached_round'),
  groupPoints: integer('group_points').notNull().default(0),
  groupGoalDiff: integer('group_goal_diff').notNull().default(0),
  groupGoalsFor: integer('group_goals_for').notNull().default(0),
  groupGoalsAgainst: integer('group_goals_against').notNull().default(0),
  yellowCards: integer('yellow_cards').notNull().default(0),
  redCards: integer('red_cards').notNull().default(0),
  lostInPenalties: boolean('lost_in_penalties').notNull().default(false),
  elimMatchGoalsFor: integer('elim_match_goals_for'),
  elimMatchGoalsAgainst: integer('elim_match_goals_against'),
  elimMatchWentToPenalties: boolean('elim_match_went_to_penalties').notNull().default(false),
})

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    externalId: text('external_id').notNull().unique(),
    stage: matchStage('stage').notNull(),
    groupName: text('group_name'),
    kickedOffAt: timestamp('kicked_off_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    teamAId: uuid('team_a_id').references(() => teams.id),
    teamBId: uuid('team_b_id').references(() => teams.id),
    scoreA: integer('score_a'),
    scoreB: integer('score_b'),
    penaltyA: integer('penalty_a'),
    penaltyB: integer('penalty_b'),
    source: text('source').notNull().default('thesportsdb'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_matches_stage').on(t.stage),
    index('idx_matches_team_a').on(t.teamAId),
    index('idx_matches_team_b').on(t.teamBId),
  ],
)

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
  (t) => [
    unique('predictions_user_category_unique').on(t.groupId, t.userId, t.categoryId),
    index('idx_predictions_group_category').on(t.groupId, t.categoryId),
    index('idx_predictions_category').on(t.categoryId),
  ],
)

export const results = pgTable(
  'results',
  {
    categoryId: uuid('category_id')
      .primaryKey()
      .references(() => categories.id),
    teamId: uuid('team_id').references(() => teams.id),
    playerId: uuid('player_id').references(() => players.id),
    playerText: text('player_text'),
    teamSet: jsonb('team_set').$type<string[]>(),
    source: text('source').notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_results_resolved_at').on(t.resolvedAt.desc())],
)

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

// Per-user opt-out granularity for the Web Push notification types. A row
// exists only when the user explicitly toggles a type off (or back on after
// a previous off). Absence of a row is interpreted as enabled = true, so
// the sender helper filters only on rows with enabled = false.
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    enabled: boolean('enabled').notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.userId, t.type] })],
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
