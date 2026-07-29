import {
  pgTable, serial, text, varchar, boolean, integer, bigint,
  timestamp, jsonb, pgEnum, decimal, uniqueIndex, index, customType
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['player', 'captain', 'assistant', 'admin', 'superadmin'])
export const tournamentTypeEnum = pgEnum('tournament_type', ['battle_royale', 'clash_squad'])
export const tournamentStatusEnum = pgEnum('tournament_status', ['draft', 'published', 'closed', 'finished'])
export const withdrawStatusEnum = pgEnum('withdraw_status', ['pending', 'approved', 'rejected', 'paid'])
export const withdrawMethodEnum = pgEnum('withdraw_method', ['paypal', 'binance', 'baridimob'])
export const txTypeEnum = pgEnum('tx_type', ['earn_ad', 'earn_tournament', 'earn_manual', 'recharge', 'deduct_tournament', 'withdraw', 'team_split', 'admin_award', 'admin_deduct'])
export const notifTypeEnum = pgEnum('notif_type', ['invitation', 'join_request', 'tournament_published', 'scrim_created', 'registration_accepted', 'tournament_reminder', 'withdrawal_approved', 'news', 'general'])
export const newsTypeEnum = pgEnum('news_type', ['news', 'announcement', 'tournament_result', 'qualified_teams'])
export const rechargeStatusEnum = pgEnum('recharge_status', ['pending', 'approved', 'rejected'])
export const teamTxTypeEnum = pgEnum('team_tx_type', ['earn_tournament', 'earn_manual', 'deduct_tournament', 'deduct_manual', 'admin_award', 'admin_deduct', 'team_split', 'withdraw'])

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  password: text('password').notNull(),
  role: userRoleEnum('role').default('player').notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  gameName: varchar('game_name', { length: 100 }),
  gameUid: varchar('game_uid', { length: 100 }),
  profilePicture: text('profile_picture'),
  profileCompleted: boolean('profile_completed').default(false).notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  emailVerifyToken: varchar('email_verify_token', { length: 64 }),
  emailVerifyExpiry: timestamp('email_verify_expiry'),
  resetToken: varchar('reset_token', { length: 64 }),
  resetTokenExpiry: timestamp('reset_token_expiry'),
  isBanned: boolean('is_banned').default(false).notNull(),
  banReason: text('ban_reason'),
  adWatchedToday: integer('ad_watched_today').default(0).notNull(),
  adWatchedDate: text('ad_watched_date'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('users_email_idx').on(t.email),
  index('users_game_uid_idx').on(t.gameUid),
])

// ─── Wallets ──────────────────────────────────────────────────────────────────
export const wallets = pgTable('wallets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  balance: integer('balance').default(0).notNull(),
  totalEarned: integer('total_earned').default(0).notNull(),
  totalSpent: integer('total_spent').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('wallets_user_idx').on(t.userId)])

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: txTypeEnum('type').notNull(),
  amount: integer('amount').notNull(),
  balanceBefore: integer('balance_before').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  description: text('description'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('tx_user_idx').on(t.userId)])

// ─── Teams ────────────────────────────────────────────────────────────────────
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  logo: text('logo'),
  captainId: integer('captain_id').notNull().references(() => users.id),
  points: integer('points').default(0).notNull(),
  totalWins: integer('total_wins').default(0).notNull(),
  totalTournaments: integer('total_tournaments').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('teams_name_idx').on(t.name)])

// ─── Team Members ─────────────────────────────────────────────────────────────
export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('team_members_unique').on(t.teamId, t.userId),
  index('team_members_user_idx').on(t.userId),
])

// ─── Invitations ──────────────────────────────────────────────────────────────
export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  invitedUserId: integer('invited_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitedByUserId: integer('invited_by_user_id').notNull().references(() => users.id),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
}, (t) => [
  index('invitations_invited_user_idx').on(t.invitedUserId),
  index('invitations_team_idx').on(t.teamId),
])

// ─── Join Requests ────────────────────────────────────────────────────────────
export const joinRequests = pgTable('join_requests', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  message: text('message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('join_requests_team_idx').on(t.teamId),
  index('join_requests_user_idx').on(t.userId),
])

// ─── Tournaments ──────────────────────────────────────────────────────────────
export const tournaments = pgTable('tournaments', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  type: tournamentTypeEnum('type').notNull(),
  banner: text('banner'),
  registrationCost: integer('registration_cost').default(0).notNull(),
  prizePool: integer('prize_pool').default(0).notNull(),
  prizeDistribution: jsonb('prize_distribution'),
  description: text('description'),
  rules: text('rules'),
  maxTeams: integer('max_teams').default(16).notNull(),
  registrationDeadline: timestamp('registration_deadline'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  status: tournamentStatusEnum('status').default('draft').notNull(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Tournament Teams ─────────────────────────────────────────────────────────
export const tournamentTeams = pgTable('tournament_teams', {
  id: serial('id').primaryKey(),
  tournamentId: integer('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 30 }).default('registered').notNull(),
  placement: integer('placement'),
  prizeAwarded: integer('prize_awarded').default(0),
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('tournament_teams_unique').on(t.tournamentId, t.teamId),
  index('tournament_teams_team_idx').on(t.teamId),
])

// ─── Scrims ────────────────────────────────────────────────────────────────────
export const scrims = pgTable('scrims', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  mode: varchar('mode', { length: 50 }).notNull(),
  maxTeams: integer('max_teams').default(16).notNull(),
  roomId: varchar('room_id', { length: 50 }),
  roomPassword: varchar('room_password', { length: 50 }),
  roomRevealAt: timestamp('room_reveal_at'),
  status: varchar('status', { length: 20 }).default('upcoming').notNull(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Scrim Registrations ──────────────────────────────────────────────────────
export const scrimRegistrations = pgTable('scrim_registrations', {
  id: serial('id').primaryKey(),
  scrimId: integer('scrim_id').notNull().references(() => scrims.id, { onDelete: 'cascade' }),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('scrim_reg_unique').on(t.scrimId, t.teamId),
  index('scrim_reg_team_idx').on(t.teamId),
])

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notifTypeEnum('type').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  data: jsonb('data'),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('notif_user_idx').on(t.userId),
  index('notif_user_read_idx').on(t.userId, t.isRead),
])

// ─── News ─────────────────────────────────────────────────────────────────────
export const news = pgTable('news', {
  id: serial('id').primaryKey(),
  type: newsTypeEnum('type').notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  content: text('content').notNull(),
  image: text('image'),
  videoUrl: text('video_url'),
  publishedAt: timestamp('published_at'),
  isPublished: boolean('is_published').default(false).notNull(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Withdraw Requests ────────────────────────────────────────────────────────
export const withdrawRequests = pgTable('withdraw_requests', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id),
  captainId: integer('captain_id').notNull().references(() => users.id),
  amountUsd: decimal('amount_usd', { precision: 10, scale: 2 }).notNull(),
  amountPoints: integer('amount_points').notNull(),
  method: withdrawMethodEnum('method').notNull(),
  paymentAddress: varchar('payment_address', { length: 200 }).notNull(),
  message: text('message'),
  status: withdrawStatusEnum('status').default('pending').notNull(),
  adminNote: text('admin_note'),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('withdraw_captain_idx').on(t.captainId),
  index('withdraw_status_idx').on(t.status),
])

// ─── Recharge Requests ────────────────────────────────────────────────────────
export const rechargeRequests = pgTable('recharge_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  amountPoints: integer('amount_points').notNull(),
  amountUsd: decimal('amount_usd', { precision: 10, scale: 2 }).notNull(),
  paymentProof: text('payment_proof'),
  status: rechargeStatusEnum('status').default('pending').notNull(),
  adminNote: text('admin_note'),
  processedBy: integer('processed_by').references(() => users.id),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('recharge_user_idx').on(t.userId),
  index('recharge_status_idx').on(t.status),
])

// ─── App Releases ─────────────────────────────────────────────────────────────
export const appReleases = pgTable('app_releases', {
  id: serial('id').primaryKey(),
  version: varchar('version', { length: 30 }).notNull(),
  apkUrl: text('apk_url').notNull(),          // e.g. /api/app-release/download/3
  apkSize: varchar('apk_size', { length: 20 }),
  apkData: customType<{ data: Buffer }>({
    dataType() { return 'bytea' },
  })('apk_data'),                               // binary stored in DB
  releaseNotes: text('release_notes'),
  isPublished: boolean('is_published').default(false).notNull(),
  forceUpdate: boolean('force_update').default(false).notNull(),
  publishedAt: timestamp('published_at'),
  uploadedBy: integer('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Team Wallets ─────────────────────────────────────────────────────────────
export const teamWallets = pgTable('team_wallets', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  balance: integer('balance').default(0).notNull(),
  lockedBalance: integer('locked_balance').default(0).notNull(),
  totalEarned: integer('total_earned').default(0).notNull(),
  totalSpent: integer('total_spent').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('team_wallets_team_idx').on(t.teamId)])

// ─── Team Transactions ────────────────────────────────────────────────────────
export const teamTransactions = pgTable('team_transactions', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  type: teamTxTypeEnum('type').notNull(),
  amount: integer('amount').notNull(),
  balanceBefore: integer('balance_before').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  description: text('description'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('team_tx_team_idx').on(t.teamId),
  index('team_tx_user_idx').on(t.userId),
])

// ─── Settings ────────────────────────────────────────────────────────────────
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('settings_key_idx').on(t.key)])

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  target: varchar('target', { length: 100 }),
  targetId: integer('target_id'),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('audit_user_idx').on(t.userId)])

// ─── FCM Tokens ───────────────────────────────────────────────────────────────
export const fcmTokens = pgTable('fcm_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  platform: varchar('platform', { length: 20 }).default('android').notNull(), // android | web | ios
  deviceId: varchar('device_id', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('fcm_user_idx').on(t.userId),
  index('fcm_token_idx').on(t.token),
  uniqueIndex('fcm_token_unique').on(t.token),
])

// ─── Analytics Events ─────────────────────────────────────────────────────────
export const analyticsEvents = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  event: varchar('event', { length: 100 }).notNull(),
  page: varchar('page', { length: 100 }),
  meta: jsonb('meta'),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  sessionId: varchar('session_id', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('analytics_event_idx').on(t.event),
  index('analytics_user_idx').on(t.userId),
  index('analytics_date_idx').on(t.createdAt),
])

// ─── Daily Analytics Aggregates ───────────────────────────────────────────────
export const dailyAnalytics = pgTable('daily_analytics', {
  id: serial('id').primaryKey(),
  date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
  metric: varchar('metric', { length: 100 }).notNull(),
  value: integer('value').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('daily_analytics_unique').on(t.date, t.metric),
  index('daily_analytics_date_idx').on(t.date),
])

// ─── Rate Limits ──────────────────────────────────────────────────────────────
export const rateLimits = pgTable('rate_limits', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 255 }).notNull(), // ip:endpoint or userId:endpoint
  count: integer('count').default(0).notNull(),
  windowStart: timestamp('window_start').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('rate_limit_key_idx').on(t.key),
  index('rate_limit_window_idx').on(t.windowStart),
])

// ─── Seasons ─────────────────────────────────────────────────────────────────
export const seasons = pgTable('seasons', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  rewards: jsonb('rewards'),          // { rank: 1, prize: 5000, badge: 'Champion' }[]
  stats: jsonb('stats'),              // aggregate stats snapshot
  rankings: jsonb('rankings'),        // final rankings snapshot
  isActive: boolean('is_active').default(false).notNull(),
  isFinished: boolean('is_finished').default(false).notNull(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('seasons_active_idx').on(t.isActive)])

// ─── Season Rankings ──────────────────────────────────────────────────────────
export const seasonRankings = pgTable('season_rankings', {
  id: serial('id').primaryKey(),
  seasonId: integer('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'set null' }),
  rank: integer('rank').notNull(),
  score: integer('score').default(0).notNull(),
  wins: integer('wins').default(0).notNull(),
  tournaments: integer('tournaments').default(0).notNull(),
  prizeEarned: integer('prize_earned').default(0).notNull(),
  rewardClaimed: boolean('reward_claimed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('season_rankings_season_idx').on(t.seasonId),
  index('season_rankings_user_idx').on(t.userId),
  index('season_rankings_team_idx').on(t.teamId),
])

// ─── Achievements ─────────────────────────────────────────────────────────────
export const achievements = pgTable('achievements', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull(),  // 'first_tournament', '10_wins', etc.
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description').notNull(),
  icon: varchar('icon', { length: 50 }).default('🏆').notNull(),
  condition: jsonb('condition').notNull(),          // { type: 'wins', value: 10 }
  points: integer('points').default(0).notNull(),
  rarity: varchar('rarity', { length: 20 }).default('common').notNull(), // common/rare/epic/legendary
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('achievements_key_idx').on(t.key)])

export const userAchievements = pgTable('user_achievements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: integer('achievement_id').notNull().references(() => achievements.id, { onDelete: 'cascade' }),
  unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('user_achievements_unique').on(t.userId, t.achievementId),
  index('user_achievements_user_idx').on(t.userId),
])

// ─── Team Chat ────────────────────────────────────────────────────────────────
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 20 }).default('message').notNull(), // message | system | image
  content: text('content').notNull(),
  imageUrl: text('image_url'),
  readBy: jsonb('read_by').default([]).notNull(), // userId[]
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('chat_team_idx').on(t.teamId),
  index('chat_created_idx').on(t.teamId, t.createdAt),
])

// ─── Match History ────────────────────────────────────────────────────────────
export const matchHistory = pgTable('match_history', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 20 }).notNull(), // tournament | scrim
  tournamentId: integer('tournament_id').references(() => tournaments.id, { onDelete: 'set null' }),
  scrimId: integer('scrim_id').references(() => scrims.id, { onDelete: 'set null' }),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  placement: integer('placement'),
  kills: integer('kills').default(0).notNull(),
  points: integer('points').default(0).notNull(),
  prizeEarned: integer('prize_earned').default(0).notNull(),
  playerStats: jsonb('player_stats'), // [{ userId, kills, deaths, assists }]
  playedAt: timestamp('played_at').defaultNow().notNull(),
}, (t) => [
  index('match_history_team_idx').on(t.teamId),
  index('match_history_type_idx').on(t.type),
  index('match_history_date_idx').on(t.playedAt),
])

// ─── Player Statistics ────────────────────────────────────────────────────────
export const playerStats = pgTable('player_stats', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  totalMatches: integer('total_matches').default(0).notNull(),
  totalKills: integer('total_kills').default(0).notNull(),
  totalDeaths: integer('total_deaths').default(0).notNull(),
  totalWins: integer('total_wins').default(0).notNull(),
  top3Finishes: integer('top3_finishes').default(0).notNull(),
  totalPlacementSum: integer('total_placement_sum').default(0).notNull(),
  totalPrizeEarned: integer('total_prize_earned').default(0).notNull(),
  adWatchedTotal: integer('ad_watched_total').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('player_stats_user_idx').on(t.userId)])

// ─── Leaderboards ─────────────────────────────────────────────────────────────
export const leaderboardSnapshots = pgTable('leaderboard_snapshots', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 50 }).notNull(), // top_teams|top_players|top_wallets|top_winners|top_mvp|top_earners
  period: varchar('period', { length: 20 }).notNull(),     // daily|weekly|monthly|all_time
  date: varchar('date', { length: 10 }).notNull(),         // YYYY-MM-DD snapshot date
  data: jsonb('data').notNull(),                           // ranked array
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('leaderboard_unique').on(t.category, t.period, t.date),
  index('leaderboard_cat_idx').on(t.category, t.period),
])

// ─── Tournament Groups ────────────────────────────────────────────────────────
export const tournamentGroups = pgTable('tournament_groups', {
  id: serial('id').primaryKey(),
  tournamentId: integer('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 10 }).notNull(),   // 'A', 'B', 'C', …
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('t_group_tournament_idx').on(t.tournamentId),
  uniqueIndex('t_group_unique').on(t.tournamentId, t.name),
])

// ─── Tournament Group Teams (one team → one group per tournament) ─────────────
export const tournamentGroupTeams = pgTable('tournament_group_teams', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').notNull().references(() => tournamentGroups.id, { onDelete: 'cascade' }),
  tournamentId: integer('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, (t) => [
  // A team can only be in one group per tournament
  uniqueIndex('t_group_team_unique').on(t.tournamentId, t.teamId),
  index('t_group_teams_group_idx').on(t.groupId),
])

// ─── Tournament Matches ───────────────────────────────────────────────────────
export const tournamentMatches = pgTable('tournament_matches', {
  id: serial('id').primaryKey(),
  tournamentId: integer('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  groupId: integer('group_id').references(() => tournamentGroups.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 200 }),
  roomId: varchar('room_id', { length: 100 }),
  roomPassword: varchar('room_password', { length: 100 }),
  matchStartTime: timestamp('match_start_time'),
  roomRevealAt: timestamp('room_reveal_at'),
  status: varchar('status', { length: 30 }).default('upcoming').notNull(), // upcoming | room_revealed | in_progress | finished
  roomNotifiedAt: timestamp('room_notified_at'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('t_match_tournament_idx').on(t.tournamentId),
  index('t_match_group_idx').on(t.groupId),
  index('t_match_reveal_idx').on(t.roomRevealAt, t.status),
])

// ─── Match Room Notification Log ──────────────────────────────────────────────
export const matchRoomLogs = pgTable('match_room_logs', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').notNull().references(() => tournamentMatches.id, { onDelete: 'cascade' }),
  tournamentId: integer('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  groupId: integer('group_id').references(() => tournamentGroups.id, { onDelete: 'set null' }),
  groupName: varchar('group_name', { length: 10 }),
  sentBy: integer('sent_by').references(() => users.id, { onDelete: 'set null' }),
  sentByName: varchar('sent_by_name', { length: 100 }),
  roomId: varchar('room_id', { length: 100 }),
  roomPassword: varchar('room_password', { length: 100 }),
  recipientCount: integer('recipient_count').default(0).notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
}, (t) => [
  index('match_room_log_match_idx').on(t.matchId),
  index('match_room_log_tourn_idx').on(t.tournamentId),
])

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ one, many }) => ({
  wallet: one(wallets, { fields: [users.id], references: [wallets.userId] }),
  teamMemberships: many(teamMembers),
  sentInvitations: many(invitations, { relationName: 'inviter' }),
  receivedInvitations: many(invitations, { relationName: 'invitee' }),
  joinRequests: many(joinRequests),
  notifications: many(notifications),
  transactions: many(transactions),
}))

export const teamsRelations = relations(teams, ({ one, many }) => ({
  captain: one(users, { fields: [teams.captainId], references: [users.id] }),
  members: many(teamMembers),
  invitations: many(invitations),
  joinRequests: many(joinRequests),
  tournamentRegistrations: many(tournamentTeams),
  scrimRegistrations: many(scrimRegistrations),
  withdrawRequests: many(withdrawRequests),
  wallet: one(teamWallets, { fields: [teams.id], references: [teamWallets.teamId] }),
  teamTransactions: many(teamTransactions),
}))

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}))

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, { fields: [wallets.userId], references: [users.id] }),
}))

export const tournamentsRelations = relations(tournaments, ({ many }) => ({
  registeredTeams: many(tournamentTeams),
}))

export const tournamentTeamsRelations = relations(tournamentTeams, ({ one }) => ({
  tournament: one(tournaments, { fields: [tournamentTeams.tournamentId], references: [tournaments.id] }),
  team: one(teams, { fields: [tournamentTeams.teamId], references: [teams.id] }),
}))

export const scrimsRelations = relations(scrims, ({ many }) => ({
  registrations: many(scrimRegistrations),
}))

export const scrimRegistrationsRelations = relations(scrimRegistrations, ({ one }) => ({
  scrim: one(scrims, { fields: [scrimRegistrations.scrimId], references: [scrims.id] }),
  team: one(teams, { fields: [scrimRegistrations.teamId], references: [teams.id] }),
}))

export const teamWalletsRelations = relations(teamWallets, ({ one }) => ({
  team: one(teams, { fields: [teamWallets.teamId], references: [teams.id] }),
}))

export const teamTransactionsRelations = relations(teamTransactions, ({ one }) => ({
  team: one(teams, { fields: [teamTransactions.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamTransactions.userId], references: [users.id] }),
}))
