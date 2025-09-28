import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Human table - stores only hashed nullifier from World ID
export const humans = pgTable("humans", {
  id: varchar("id").primaryKey(), // hashed nullifier from World ID
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  capsuleSeen: boolean("capsule_seen").default(false).notNull(),
  muteList: jsonb("mute_list").$type<string[]>().default([]).notNull(),
  preferredLanguage: varchar("preferred_language", { length: 10 }).default("en").notNull(), // User's preferred language (e.g., 'en', 'es', 'fr')
  role: varchar("role", { enum: ["guest", "verified", "admin"] }).default("guest").notNull(), // User role for access control
});

// Message table - for both global and work rooms
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  room: varchar("room", { enum: ["global", "work"] }).notNull(),
  authorHumanId: varchar("author_human_id").notNull().references(() => humans.id),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  starsCount: integer("stars_count").default(0).notNull(),
  reportsCount: integer("reports_count").default(0).notNull(),
  // Work mode specific fields
  category: varchar("category", { enum: ["help", "advice", "collab"] }),
  link: text("link"),
  geoScope: varchar("geo_scope").default("Global"),
  isHidden: boolean("is_hidden").default(false).notNull(),
  authorRole: varchar("author_role", { enum: ["guest", "verified", "admin"] }).default("guest").notNull(), // Role of message author
});

// Star table - tracks upvotes (1 per human per message)
export const stars = pgTable("stars", {
  messageId: varchar("message_id").notNull().references(() => messages.id),
  humanId: varchar("human_id").notNull().references(() => humans.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Rate limit tracking
export const rateLimits = pgTable("rate_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  humanId: varchar("human_id").notNull().references(() => humans.id),
  action: varchar("action").notNull(), // 'message', 'star', 'work_link'
  count: integer("count").default(1).notNull(),
  windowStart: timestamp("window_start").defaultNow().notNull(),
  windowType: varchar("window_type").notNull(), // 'minute', 'hour', 'day'
});

// Enhanced topic system for daily rotation
export const topics = pgTable("topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: varchar("category", { enum: ["general", "tech", "collaboration", "inspiration", "creativity", "learning", "community", "wellness"] }).notNull().default("general"),
  authorHumanId: varchar("author_human_id").references(() => humans.id),
  authorName: text("author_name"), // Display name for topic author
  status: varchar("status", { enum: ["draft", "approved", "active", "archived"] }).notNull().default("draft"),
  priority: integer("priority").default(0).notNull(), // Higher priority topics get precedence
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),
  isSpecial: boolean("is_special").default(false).notNull(), // For featured/special event topics
  translations: jsonb("translations").$type<{
    [languageCode: string]: {
      title: string;
      description?: string;
    };
  }>().default({}).notNull(), // Multilingual translations for topics
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Topic schedules for rotation system
export const topicSchedules = pgTable("topic_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").notNull().references(() => topics.id),
  scheduledDate: varchar("scheduled_date").notNull(), // YYYY-MM-DD format
  activatedAt: timestamp("activated_at"),
  deactivatedAt: timestamp("deactivated_at"),
  rotationType: varchar("rotation_type", { enum: ["daily", "weekly", "special"] }).notNull().default("daily"),
  isActive: boolean("is_active").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Topic engagement metrics
export const topicEngagement = pgTable("topic_engagement", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").notNull().references(() => topics.id),
  date: varchar("date").notNull(), // YYYY-MM-DD format
  messagesCount: integer("messages_count").default(0).notNull(),
  starsCount: integer("stars_count").default(0).notNull(),
  participantsCount: integer("participants_count").default(0).notNull(),
  avgEngagementScore: integer("avg_engagement_score").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Legacy themes table kept for backward compatibility during transition
export const themes = pgTable("themes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: varchar("date").notNull().unique(), // YYYY-MM-DD format
  topicText: text("topic_text").notNull(),
});

// Report tracking
export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id),
  reporterHumanId: varchar("reporter_human_id").notNull().references(() => humans.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Room Rain ledger entries (points only)
export const ledgerEntries = pgTable("ledger_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  totalPoints: integer("total_points").notNull(),
  participantCount: integer("participant_count").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Connect requests (stub for future DM feature)
export const connectRequests = pgTable("connect_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterHumanId: varchar("requester_human_id").notNull().references(() => humans.id),
  targetHumanId: varchar("target_human_id").notNull().references(() => humans.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Guest sessions for tracking anonymous users
export const guestSessions = pgTable("guest_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipHash: varchar("ip_hash").notNull(), // SHA-256 hash of IP for privacy
  userAgentHash: varchar("user_agent_hash").notNull(), // SHA-256 hash of user agent
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  messageCount: integer("message_count").default(0).notNull(),
  dayBucket: varchar("day_bucket").notNull(), // YYYY-MM-DD format for daily limits
});

// Invite codes for referral system
export const inviteCodes = pgTable("invite_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 8 }).notNull().unique(), // Short memorable codes
  creatorHumanId: varchar("creator_human_id").notNull().references(() => humans.id),
  isActive: boolean("is_active").default(true).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  maxUsage: integer("max_usage").default(100).notNull(), // Limit per invite code
  expiresAt: timestamp("expires_at"), // Optional expiration
  customMessage: text("custom_message"), // Optional personal message
  metadata: jsonb("metadata").$type<{
    source?: string; // 'app', 'qr_code', 'social_share'
    campaign?: string; // For tracking different invite campaigns
    version?: string; // A/B testing different invite flows
  }>().default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Referral relationships between users
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inviterHumanId: varchar("inviter_human_id").notNull().references(() => humans.id),
  inviteeHumanId: varchar("invitee_human_id").notNull().references(() => humans.id),
  inviteCodeId: varchar("invite_code_id").notNull().references(() => inviteCodes.id),
  inviteCode: varchar("invite_code", { length: 8 }).notNull(), // Denormalized for quick lookup
  status: varchar("status", { enum: ["pending", "completed", "cancelled"] }).notNull().default("completed"),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  metadata: jsonb("metadata").$type<{
    joinedViaUrl?: string; // Track entry point
    userAgent?: string; // Track device/browser
    referrer?: string; // Track traffic source
    ipCountry?: string; // Geographic tracking (anonymized)
  }>().default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Referral rewards tracking
export const referralRewards = pgTable("referral_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralId: varchar("referral_id").notNull().references(() => referrals.id),
  recipientHumanId: varchar("recipient_human_id").notNull().references(() => humans.id),
  recipientType: varchar("recipient_type", { enum: ["inviter", "invitee"] }).notNull(),
  rewardType: varchar("reward_type", { enum: ["referral_bonus", "milestone_bonus", "special_event"] }).notNull(),
  pointsAwarded: integer("points_awarded").default(0).notNull(),
  tokenAmountAwarded: text("token_amount_awarded").default("0").notNull(), // For future token rewards
  tokenId: varchar("token_id").references(() => supportedTokens.id), // Optional token reward
  milestoneLevel: integer("milestone_level"), // 5, 10, 25, 50, 100 referrals
  description: text("description").notNull(),
  isProcessed: boolean("is_processed").default(false).notNull(),
  processedAt: timestamp("processed_at"),
  metadata: jsonb("metadata").$type<{
    campaign?: string;
    bonusMultiplier?: number;
    specialEvent?: string;
    txHash?: string; // For token distributions
  }>().default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Referral milestones and achievements
export const referralMilestones = pgTable("referral_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  humanId: varchar("human_id").notNull().references(() => humans.id),
  milestoneType: varchar("milestone_type", { enum: ["referral_count", "conversion_rate", "streak", "special"] }).notNull(),
  level: integer("level").notNull(), // 5, 10, 25, 50, 100 for referral_count
  value: integer("value").notNull(), // Actual count/rate achieved
  title: text("title").notNull(),
  description: text("description").notNull(),
  pointsRewarded: integer("points_rewarded").default(0).notNull(),
  tokenAmountRewarded: text("token_amount_rewarded").default("0").notNull(),
  tokenId: varchar("token_id").references(() => supportedTokens.id),
  badgeIcon: varchar("badge_icon", { length: 50 }), // Icon name for UI
  badgeColor: varchar("badge_color", { length: 20 }), // Color for UI
  isSpecial: boolean("is_special").default(false).notNull(), // Featured achievements
  achievedAt: timestamp("achieved_at").defaultNow().notNull(),
  notifiedAt: timestamp("notified_at"), // Track if user was notified
});

// Invite analytics and tracking
export const inviteAnalytics = pgTable("invite_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inviteCodeId: varchar("invite_code_id").notNull().references(() => inviteCodes.id),
  eventType: varchar("event_type", { enum: ["link_click", "page_view", "registration_start", "registration_complete", "first_message"] }).notNull(),
  sessionId: varchar("session_id"), // Track user journey
  metadata: jsonb("metadata").$type<{
    userAgent?: string;
    referrer?: string;
    ipCountry?: string;
    timeOnPage?: number;
    stepCompleted?: string;
    errorEncountered?: string;
  }>().default({}).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Daily referral leaderboard snapshots
export const referralLeaderboards = pgTable("referral_leaderboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  humanId: varchar("human_id").notNull().references(() => humans.id),
  period: varchar("period", { enum: ["daily", "weekly", "monthly", "all_time"] }).notNull(),
  date: varchar("date").notNull(), // YYYY-MM-DD format
  rank: integer("rank").notNull(),
  referralCount: integer("referral_count").notNull(),
  conversionRate: integer("conversion_rate").notNull(), // Percentage * 100 (e.g., 8543 = 85.43%)
  pointsEarned: integer("points_earned").notNull(),
  tokensEarned: text("tokens_earned").default("0").notNull(),
  isTopPerformer: boolean("is_top_performer").default(false).notNull(), // Top 10%
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Supported ERC-20 tokens configuration
export const supportedTokens = pgTable("supported_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  address: varchar("address").notNull().unique(), // Token contract address
  symbol: varchar("symbol").notNull(), // e.g., USDC, USDT, DAI
  name: text("name").notNull(), // e.g., USD Coin
  decimals: integer("decimals").notNull(), // Token decimals (e.g., 6 for USDC, 18 for DAI)
  chainId: integer("chain_id").notNull(), // Network chain ID (e.g., 1 for Ethereum, 137 for Polygon)
  networkName: varchar("network_name").notNull(), // e.g., ethereum, polygon
  isActive: boolean("is_active").default(true).notNull(),
  minDistributionAmount: text("min_distribution_amount").notNull(), // Minimum token amount for distributions (as string to avoid precision issues)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User token balances for each supported token
export const userTokenBalances = pgTable("user_token_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  humanId: varchar("human_id").notNull().references(() => humans.id),
  tokenId: varchar("token_id").notNull().references(() => supportedTokens.id),
  balance: text("balance").default("0").notNull(), // Current balance as string (to avoid precision loss)
  lifetimeEarned: text("lifetime_earned").default("0").notNull(), // Total earned as string
  lifetimeSpent: text("lifetime_spent").default("0").notNull(), // Total spent as string
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// Token distribution events - replaces point distributions
export const tokenDistributionEvents = pgTable("token_distribution_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { enum: ["daily_rain", "weekly_rain", "bonus_distribution"] }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  tokenId: varchar("token_id").notNull().references(() => supportedTokens.id),
  totalAmount: text("total_amount").notNull(), // Total token amount distributed as string
  participantCount: integer("participant_count").notNull(),
  room: varchar("room", { enum: ["global", "work"] }).notNull(),
  calculationData: jsonb("calculation_data").$type<{
    timeRange: { start: string; end: string };
    tokensPerMessage: string;
    tokensPerStar: string;
    activityMultiplier: number;
    workModeBonus: number;
    tokenAddress: string;
    chainId: number;
  }>().notNull(),
  txHash: varchar("tx_hash"), // Transaction hash for the batch distribution
  status: varchar("status", { enum: ["pending", "processing", "completed", "failed"] }).default("pending").notNull(),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Token transactions - tracks all token earning and spending
export const tokenTransactions = pgTable("token_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  humanId: varchar("human_id").notNull().references(() => humans.id),
  tokenId: varchar("token_id").notNull().references(() => supportedTokens.id),
  type: varchar("type", { enum: ["earn", "spend", "transfer_in", "transfer_out"] }).notNull(),
  source: varchar("source", { enum: ["message", "star", "work_bonus", "daily_rain", "weekly_rain", "activity_bonus", "manual_distribution"] }).notNull(),
  amount: text("amount").notNull(), // Token amount as string
  description: text("description").notNull(),
  messageId: varchar("message_id").references(() => messages.id), // Optional reference to related message
  distributionEventId: varchar("distribution_event_id").references(() => tokenDistributionEvents.id), // Optional reference to distribution event
  txHash: varchar("tx_hash"), // Blockchain transaction hash
  permitSignature: jsonb("permit_signature").$type<{
    signature: string;
    deadline: number;
    nonce: number;
  }>(), // Permit2 signature data
  status: varchar("status", { enum: ["pending", "processing", "completed", "failed"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Permit2 signatures for gasless transfers
export const permit2Signatures = pgTable("permit2_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  humanId: varchar("human_id").notNull().references(() => humans.id),
  tokenId: varchar("token_id").notNull().references(() => supportedTokens.id),
  signature: text("signature").notNull(), // The permit signature
  amount: text("amount").notNull(), // Amount approved as string
  deadline: integer("deadline").notNull(), // Unix timestamp
  nonce: integer("nonce").notNull(), // Permit2 nonce
  spender: varchar("spender").notNull(), // Address authorized to spend
  used: boolean("used").default(false).notNull(),
  txHash: varchar("tx_hash"), // Transaction hash when signature is used
  createdAt: timestamp("created_at").defaultNow().notNull(),
  usedAt: timestamp("used_at"),
});

// Legacy: Keep point balances for backward compatibility during migration
export const userPointBalances = pgTable("user_point_balances", {
  humanId: varchar("human_id").primaryKey().references(() => humans.id),
  totalPoints: integer("total_points").default(0).notNull(),
  lifetimeEarned: integer("lifetime_earned").default(0).notNull(),
  lifetimeSpent: integer("lifetime_spent").default(0).notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// Legacy: Keep point distribution events for backward compatibility
export const distributionEvents = pgTable("distribution_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { enum: ["daily_rain", "weekly_rain"] }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  totalPoints: integer("total_points").notNull(),
  participantCount: integer("participant_count").notNull(),
  room: varchar("room", { enum: ["global", "work"] }).notNull(),
  calculationData: jsonb("calculation_data").$type<{
    timeRange: { start: string; end: string };
    pointsPerMessage: number;
    pointsPerStar: number;
    activityMultiplier: number;
    workModeBonus: number;
  }>().notNull(),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Legacy: Keep point transactions for backward compatibility
export const pointTransactions = pgTable("point_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  humanId: varchar("human_id").notNull().references(() => humans.id),
  type: varchar("type", { enum: ["earn", "spend"] }).notNull(),
  source: varchar("source", { enum: ["message", "star", "work_bonus", "daily_rain", "weekly_rain", "activity_bonus"] }).notNull(),
  points: integer("points").notNull(),
  description: text("description").notNull(),
  messageId: varchar("message_id").references(() => messages.id), // Optional reference to related message
  distributionEventId: varchar("distribution_event_id").references(() => distributionEvents.id), // Optional reference to distribution event
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


// User participation metrics for calculating distributions
export const participationMetrics = pgTable("participation_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  humanId: varchar("human_id").notNull().references(() => humans.id),
  date: varchar("date").notNull(), // YYYY-MM-DD format
  room: varchar("room", { enum: ["global", "work"] }).notNull(),
  messagesPosted: integer("messages_posted").default(0).notNull(),
  starsReceived: integer("stars_received").default(0).notNull(),
  starsGiven: integer("stars_given").default(0).notNull(),
  workLinksShared: integer("work_links_shared").default(0).notNull(),
  helpPostsCreated: integer("help_posts_created").default(0).notNull(),
  advicePostsCreated: integer("advice_posts_created").default(0).notNull(),
  collabPostsCreated: integer("collab_posts_created").default(0).notNull(),
  lastActive: timestamp("last_active").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertHumanSchema = createInsertSchema(humans).omit({
  joinedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  starsCount: true,
  reportsCount: true,
  isHidden: true,
  authorHumanId: true, // This will be added by authentication middleware
});

export const insertStarSchema = createInsertSchema(stars).omit({
  createdAt: true,
  humanId: true, // This will be added by authentication middleware
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
  reporterHumanId: true, // This will be added by authentication middleware
});

// Topic system insert schemas
export const insertTopicSchema = createInsertSchema(topics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTopicScheduleSchema = createInsertSchema(topicSchedules).omit({
  id: true,
  activatedAt: true,
  deactivatedAt: true,
  createdAt: true,
});

export const insertTopicEngagementSchema = createInsertSchema(topicEngagement).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Legacy theme schema
export const insertThemeSchema = createInsertSchema(themes).omit({
  id: true,
});

export const insertLedgerEntrySchema = createInsertSchema(ledgerEntries).omit({
  id: true,
  createdAt: true,
});

export const insertConnectRequestSchema = createInsertSchema(connectRequests).omit({
  id: true,
  createdAt: true,
  requesterHumanId: true, // This will be added by authentication middleware
});

export const insertGuestSessionSchema = createInsertSchema(guestSessions).omit({
  id: true,
  createdAt: true,
  lastSeen: true,
});

// Token system insert schemas
export const insertSupportedTokenSchema = createInsertSchema(supportedTokens).omit({
  id: true,
  createdAt: true,
});

export const insertUserTokenBalanceSchema = createInsertSchema(userTokenBalances).omit({
  id: true,
  lastUpdated: true,
});

export const insertTokenDistributionEventSchema = createInsertSchema(tokenDistributionEvents).omit({
  id: true,
  executedAt: true,
  createdAt: true,
});

export const insertTokenTransactionSchema = createInsertSchema(tokenTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertPermit2SignatureSchema = createInsertSchema(permit2Signatures).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

// Legacy: Keep point system insert schemas for backward compatibility
export const insertUserPointBalanceSchema = createInsertSchema(userPointBalances).omit({
  lastUpdated: true,
});

export const insertPointTransactionSchema = createInsertSchema(pointTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertDistributionEventSchema = createInsertSchema(distributionEvents).omit({
  id: true,
  executedAt: true,
  createdAt: true,
});

export const insertParticipationMetricSchema = createInsertSchema(participationMetrics).omit({
  id: true,
  lastActive: true,
  updatedAt: true,
});

// Types
export type InsertHuman = z.infer<typeof insertHumanSchema>;
export type Human = typeof humans.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertGuestSession = z.infer<typeof insertGuestSessionSchema>;
export type GuestSession = typeof guestSessions.$inferSelect;

export type InsertStar = z.infer<typeof insertStarSchema>;
export type Star = typeof stars.$inferSelect;

export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

// Topic system types
export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type Topic = typeof topics.$inferSelect;

export type InsertTopicSchedule = z.infer<typeof insertTopicScheduleSchema>;
export type TopicSchedule = typeof topicSchedules.$inferSelect;

export type InsertTopicEngagement = z.infer<typeof insertTopicEngagementSchema>;
export type TopicEngagement = typeof topicEngagement.$inferSelect;

// Legacy theme types
export type InsertTheme = z.infer<typeof insertThemeSchema>;
export type Theme = typeof themes.$inferSelect;

export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;

export type InsertConnectRequest = z.infer<typeof insertConnectRequestSchema>;
export type ConnectRequest = typeof connectRequests.$inferSelect;

// Token system types
export type InsertSupportedToken = z.infer<typeof insertSupportedTokenSchema>;
export type SupportedToken = typeof supportedTokens.$inferSelect;

export type InsertUserTokenBalance = z.infer<typeof insertUserTokenBalanceSchema>;
export type UserTokenBalance = typeof userTokenBalances.$inferSelect;

export type InsertTokenDistributionEvent = z.infer<typeof insertTokenDistributionEventSchema>;
export type TokenDistributionEvent = typeof tokenDistributionEvents.$inferSelect;

export type InsertTokenTransaction = z.infer<typeof insertTokenTransactionSchema>;
export type TokenTransaction = typeof tokenTransactions.$inferSelect;

export type InsertPermit2Signature = z.infer<typeof insertPermit2SignatureSchema>;
export type Permit2Signature = typeof permit2Signatures.$inferSelect;

// Legacy: Keep point system types for backward compatibility
export type InsertUserPointBalance = z.infer<typeof insertUserPointBalanceSchema>;
export type UserPointBalance = typeof userPointBalances.$inferSelect;

export type InsertPointTransaction = z.infer<typeof insertPointTransactionSchema>;
export type PointTransaction = typeof pointTransactions.$inferSelect;

export type InsertDistributionEvent = z.infer<typeof insertDistributionEventSchema>;
export type DistributionEvent = typeof distributionEvents.$inferSelect;

export type InsertParticipationMetric = z.infer<typeof insertParticipationMetricSchema>;
export type ParticipationMetric = typeof participationMetrics.$inferSelect;

// Extended types for frontend
export type MessageWithAuthor = Message & {
  authorHandle: string;
  isStarredByUser?: boolean;
};

export type HumanProfile = {
  id: string;
  handle: string;
  initials: string;
  firstSeen: string;
  totalPosts: number;
  starsReceived: number;
  pointBalance: number;
  lifetimePointsEarned: number;
  pointsEarnedToday: number;
  leaderboardRank?: number;
};

export type OnlinePresence = {
  count: number;
  roundedCount: string;
};

// Extended types for token system
export type TokenSummary = {
  tokenId: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  networkName: string;
  balance: string;
  lifetimeEarned: string;
  lifetimeSpent: string;
};

export type UserTokenSummary = {
  humanId: string;
  handle: string;
  tokens: TokenSummary[];
  totalValueUsd?: number;
  rank?: number;
};

export type TokenBreakdown = {
  source: string;
  amount: string;
  count: number;
  description: string;
  tokenSymbol: string;
};

export type UserTokenHistory = {
  transactions: TokenTransaction[];
  breakdown: TokenBreakdown[];
  tokens: TokenSummary[];
  totalValueEarned?: string;
  totalValueSpent?: string;
};

export type TokenDistributionSummary = {
  totalParticipants: number;
  totalTokensDistributed: string;
  tokenSymbol: string;
  averageTokensPerUser: string;
  topRecipients: UserTokenSummary[];
  distributionMethod: string;
  txHash?: string;
  status: string;
};

export type TokenLeaderboardEntry = {
  rank: number;
  humanId: string;
  handle: string;
  initials: string;
  tokenValue: string;
  tokenSymbol: string;
  trend: 'up' | 'down' | 'same';
};

// Enhanced profile type that includes token balances
export type EnhancedHumanProfile = HumanProfile & {
  tokenBalances: TokenSummary[];
  totalTokenValueUsd?: number;
};

// Legacy: Extended types for points system (kept for backward compatibility)
export type UserPointSummary = {
  humanId: string;
  handle: string;
  totalPoints: number;
  lifetimeEarned: number;
  pointsToday: number;
  rank: number;
};

export type PointBreakdown = {
  source: string;
  points: number;
  count: number;
  description: string;
};

export type UserPointHistory = {
  transactions: PointTransaction[];
  breakdown: PointBreakdown[];
  totalEarned: number;
  totalSpent: number;
  currentBalance: number;
};

export type DistributionSummary = {
  totalParticipants: number;
  totalPointsDistributed: number;
  averagePointsPerUser: number;
  topRecipients: UserPointSummary[];
  distributionMethod: string;
};

export type LeaderboardEntry = {
  rank: number;
  humanId: string;
  handle: string;
  initials: string;
  points: number;
  trend: 'up' | 'down' | 'same';
};

// Extended types for topic management system
export type TopicWithSchedule = Topic & {
  schedule?: TopicSchedule;
  engagement?: TopicEngagement;
  isScheduled: boolean;
  isActive: boolean;
};

export type TopicAnalytics = {
  topicId: string;
  title: string;
  category: string;
  totalDays: number;
  totalMessages: number;
  totalStars: number;
  totalParticipants: number;
  avgEngagementPerDay: number;
  lastUsed?: string;
  performanceScore: number;
};

export type DailyTopicInfo = {
  current: TopicWithSchedule | null;
  upcoming: TopicWithSchedule[];
  recent: TopicWithSchedule[];
  fallback: Topic;
};

export type AdminTopicSummary = {
  totalTopics: number;
  activeTopics: number;
  scheduledTopics: number;
  draftTopics: number;
  topCategories: { category: string; count: number }[];
  recentActivity: TopicAnalytics[];
};

// Invite system types
export type InviteCode = typeof inviteCodes.$inferSelect;
export type InsertInviteCode = typeof inviteCodes.$inferInsert;

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

export type ReferralReward = typeof referralRewards.$inferSelect;
export type InsertReferralReward = typeof referralRewards.$inferInsert;

export type ReferralMilestone = typeof referralMilestones.$inferSelect;
export type InsertReferralMilestone = typeof referralMilestones.$inferInsert;

export type InviteAnalytics = typeof inviteAnalytics.$inferSelect;
export type InsertInviteAnalytics = typeof inviteAnalytics.$inferInsert;

export type ReferralLeaderboard = typeof referralLeaderboards.$inferSelect;
export type InsertReferralLeaderboard = typeof referralLeaderboards.$inferInsert;

// Extended invite types for API responses
export type InviteCodeWithStats = InviteCode & {
  totalReferrals: number;
  successfulReferrals: number;
  conversionRate: number;
  totalRewards: number;
  isExpired: boolean;
  daysActive: number;
  totalClicks: number;
  conversions: number;
  creatorHandle?: string;
};

export type ReferralWithDetails = Referral & {
  inviter: {
    handle: string;
    initials: string;
  };
  invitee: {
    handle: string;
    initials: string;
  };
  inviteCodeData: InviteCode;
  rewards: ReferralReward[];
  inviteeHandle?: string;
  pointsEarned?: number;
};

export type ReferralDashboard = {
  humanId: string;
  handle: string;
  totalReferrals: number;
  successfulReferrals: number;
  conversionRate: number;
  totalPointsEarned: number;
  totalTokensEarned: string;
  currentRank: number;
  activeCodes: InviteCodeWithStats[];
  recentReferrals: ReferralWithDetails[];
  milestones: ReferralMilestone[];
  nextMilestone?: {
    level: number;
    progress: number;
    remaining: number;
    reward: number;
  };
};

export type ReferralLeaderboardEntry = {
  rank: number;
  humanId: string;
  handle: string;
  initials: string;
  referralCount: number;
  conversionRate: number;
  pointsEarned: number;
  tokensEarned: string;
  isCurrentUser: boolean;
  trend: 'up' | 'down' | 'same';
  badges: string[];
};

export type InviteAnalyticsSummary = {
  inviteCodeId: string;
  code: string;
  totalClicks: number;
  uniqueVisitors: number;
  registrations: number;
  conversions: number;
  conversionRate: number;
  topSources: { source: string; count: number }[];
  topCountries: { country: string; count: number }[];
  timeline: { date: string; clicks: number; conversions: number }[];
};

export type ReferralSystemStats = {
  totalInviteCodes: number;
  totalReferrals: number;
  totalRewardsDistributed: number;
  averageConversionRate: number;
  topPerformers: ReferralLeaderboardEntry[];
  recentActivity: {
    date: string;
    newReferrals: number;
    rewardsDistributed: number;
  }[];
  milestoneBreakdown: {
    level: number;
    achievedCount: number;
    totalRewards: number;
  }[];
};

// ===== ENHANCED MODERATION SYSTEM TABLES =====

// Content moderation analysis results
export const moderationAnalysis = pgTable("moderation_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentId: varchar("content_id").notNull(), // Message ID or other content
  contentType: varchar("content_type", { enum: ["message", "profile", "topic"] }).notNull(),
  contentText: text("content_text").notNull(),
  language: varchar("language", { length: 10 }).notNull(),
  
  // Analysis scores (0-100, higher = more problematic)
  toxicityScore: integer("toxicity_score").default(0).notNull(),
  sentimentScore: integer("sentiment_score").default(50).notNull(), // 0=very negative, 50=neutral, 100=very positive
  spamScore: integer("spam_score").default(0).notNull(),
  scamScore: integer("scam_score").default(0).notNull(),
  promotionalScore: integer("promotional_score").default(0).notNull(),
  
  // Detailed analysis results
  detectedLanguages: jsonb("detected_languages").$type<string[]>().default([]).notNull(),
  flaggedPatterns: jsonb("flagged_patterns").$type<string[]>().default([]).notNull(),
  extractedUrls: jsonb("extracted_urls").$type<{
    url: string;
    domain: string;
    reputation: 'safe' | 'suspicious' | 'malicious' | 'unknown';
    reputationScore: number;
  }[]>().default([]).notNull(),
  
  // ML model results
  semanticCategories: jsonb("semantic_categories").$type<{
    category: string;
    confidence: number;
  }[]>().default([]).notNull(),
  
  // Overall assessment
  riskLevel: varchar("risk_level", { enum: ["low", "medium", "high", "critical"] }).notNull().default("low"),
  recommendedAction: varchar("recommended_action", { 
    enum: ["approve", "review", "auto_warn", "auto_hide", "auto_ban"] 
  }).notNull().default("approve"),
  
  // Analysis metadata
  analysisVersion: varchar("analysis_version").notNull().default("1.0"),
  processingTime: integer("processing_time_ms").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Moderation actions and decisions
export const moderationActions = pgTable("moderation_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetId: varchar("target_id").notNull(), // Message ID, Human ID, etc.
  targetType: varchar("target_type", { enum: ["message", "human", "topic"] }).notNull(),
  moderatorId: varchar("moderator_id").references(() => humans.id), // null for automated actions
  moderatorType: varchar("moderator_type", { enum: ["human", "auto", "ml"] }).notNull().default("auto"),
  
  actionType: varchar("action_type", { 
    enum: ["warn", "hide", "delete", "shadow_ban", "temp_ban", "perm_ban", "approve", "restore"] 
  }).notNull(),
  
  reason: text("reason").notNull(),
  severity: varchar("severity", { enum: ["low", "medium", "high", "critical"] }).notNull(),
  duration: integer("duration_hours"), // For temporary actions
  expiresAt: timestamp("expires_at"), // When action expires
  
  // Context and evidence
  analysisId: varchar("analysis_id").references(() => moderationAnalysis.id),
  reportIds: jsonb("report_ids").$type<string[]>().default([]).notNull(),
  evidence: jsonb("evidence").$type<{
    automatedFlags: string[];
    humanReports: number;
    similarContent: string[];
    userHistory: string[];
  }>().default({}).notNull(),
  
  // Action metadata
  isAppeal: boolean("is_appeal").default(false).notNull(),
  isOverride: boolean("is_override").default(false).notNull(),
  overriddenActionId: varchar("overridden_action_id").references(() => moderationActions.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User trust and reputation scores
export const userTrustScores = pgTable("user_trust_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  humanId: varchar("human_id").notNull().references(() => humans.id).unique(),
  
  // Core trust metrics (0-100)
  overallTrustScore: integer("overall_trust_score").default(50).notNull(),
  contentQualityScore: integer("content_quality_score").default(50).notNull(),
  communityEngagementScore: integer("community_engagement_score").default(50).notNull(),
  reportAccuracyScore: integer("report_accuracy_score").default(50).notNull(),
  
  // Behavioral indicators
  totalMessages: integer("total_messages").default(0).notNull(),
  totalReportsReceived: integer("total_reports_received").default(0).notNull(),
  totalReportsMade: integer("total_reports_made").default(0).notNull(),
  accurateReports: integer("accurate_reports").default(0).notNull(),
  falseReports: integer("false_reports").default(0).notNull(),
  
  // Moderation history
  warningsCount: integer("warnings_count").default(0).notNull(),
  tempBansCount: integer("temp_bans_count").default(0).notNull(),
  lastViolationAt: timestamp("last_violation_at"),
  daysWithoutViolation: integer("days_without_violation").default(0).notNull(),
  
  // Trust level and permissions
  trustLevel: varchar("trust_level", { 
    enum: ["new", "basic", "trusted", "veteran", "restricted", "suspended"] 
  }).notNull().default("new"),
  
  canReportUsers: boolean("can_report_users").default(true).notNull(),
  requiresReview: boolean("requires_review").default(false).notNull(),
  maxDailyMessages: integer("max_daily_messages").default(200).notNull(),
  
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Enhanced reports with detailed categorization
export const enhancedReports = pgTable("enhanced_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id),
  reporterHumanId: varchar("reporter_human_id").notNull().references(() => humans.id),
  
  // Report categorization
  category: varchar("category", { 
    enum: ["spam", "harassment", "hate_speech", "violence", "misinformation", "scam", "nsfw", "off_topic", "other"] 
  }).notNull(),
  subcategory: varchar("subcategory"),
  
  // Additional context
  description: text("description"),
  confidence: integer("confidence").default(50).notNull(), // Reporter's confidence 0-100
  
  // Report processing
  status: varchar("status", { 
    enum: ["pending", "reviewing", "resolved", "dismissed", "escalated"] 
  }).notNull().default("pending"),
  
  reviewedBy: varchar("reviewed_by").references(() => humans.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  resolution: varchar("resolution", { 
    enum: ["valid", "invalid", "duplicate", "escalated"] 
  }),
  actionTaken: varchar("action_taken").references(() => moderationActions.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Content similarity tracking for duplicate detection
export const contentSimilarity = pgTable("content_similarity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentId: varchar("content_id").notNull(),
  contentType: varchar("content_type", { enum: ["message", "topic"] }).notNull(),
  contentHash: varchar("content_hash").notNull(), // Hash of normalized content
  semanticHash: varchar("semantic_hash").notNull(), // Semantic similarity hash
  
  // Similarity analysis
  duplicateGroup: varchar("duplicate_group"), // Groups similar content
  similarityScore: integer("similarity_score").default(0).notNull(), // 0-100
  isSpamCluster: boolean("is_spam_cluster").default(false).notNull(),
  
  // Content features for ML
  wordCount: integer("word_count").default(0).notNull(),
  uniqueWordRatio: integer("unique_word_ratio").default(0).notNull(),
  uppercaseRatio: integer("uppercase_ratio").default(0).notNull(),
  urlCount: integer("url_count").default(0).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Moderation queue for admin review
export const moderationQueue = pgTable("moderation_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentId: varchar("content_id").notNull(),
  contentType: varchar("content_type", { enum: ["message", "human", "topic"] }).notNull(),
  
  priority: varchar("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  queueType: varchar("queue_type", { 
    enum: ["auto_flagged", "user_reported", "appeal", "escalation"] 
  }).notNull(),
  
  // Queue item details
  analysisId: varchar("analysis_id").references(() => moderationAnalysis.id),
  reportCount: integer("report_count").default(0).notNull(),
  flaggedReasons: jsonb("flagged_reasons").$type<string[]>().default([]).notNull(),
  
  // Processing status
  status: varchar("status", { 
    enum: ["pending", "in_review", "resolved", "escalated"] 
  }).notNull().default("pending"),
  
  assignedTo: varchar("assigned_to").references(() => humans.id),
  assignedAt: timestamp("assigned_at"),
  
  // Resolution
  reviewedBy: varchar("reviewed_by").references(() => humans.id),
  reviewedAt: timestamp("reviewed_at"),
  actionTaken: varchar("action_taken").references(() => moderationActions.id),
  reviewNotes: text("review_notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Appeals system
export const moderationAppeals = pgTable("moderation_appeals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalActionId: varchar("original_action_id").notNull().references(() => moderationActions.id),
  appellantId: varchar("appellant_id").notNull().references(() => humans.id),
  
  reason: text("reason").notNull(),
  additionalContext: text("additional_context"),
  
  status: varchar("status", { 
    enum: ["pending", "reviewing", "approved", "denied", "escalated"] 
  }).notNull().default("pending"),
  
  reviewedBy: varchar("reviewed_by").references(() => humans.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  newActionId: varchar("new_action_id").references(() => moderationActions.id), // If appeal results in new action
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Moderation statistics and metrics
export const moderationStats = pgTable("moderation_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: varchar("date").notNull().unique(), // YYYY-MM-DD format
  
  // Content volume
  totalMessages: integer("total_messages").default(0).notNull(),
  flaggedMessages: integer("flagged_messages").default(0).notNull(),
  hiddenMessages: integer("hidden_messages").default(0).notNull(),
  deletedMessages: integer("deleted_messages").default(0).notNull(),
  
  // Reports and actions
  totalReports: integer("total_reports").default(0).notNull(),
  validReports: integer("valid_reports").default(0).notNull(),
  falsePositives: integer("false_positives").default(0).notNull(),
  autoActions: integer("auto_actions").default(0).notNull(),
  humanActions: integer("human_actions").default(0).notNull(),
  
  // User actions
  warnings: integer("warnings").default(0).notNull(),
  tempBans: integer("temp_bans").default(0).notNull(),
  permBans: integer("perm_bans").default(0).notNull(),
  appeals: integer("appeals").default(0).notNull(),
  appealApprovals: integer("appeal_approvals").default(0).notNull(),
  
  // Performance metrics
  averageReviewTime: integer("average_review_time_minutes").default(0).notNull(),
  automationAccuracy: integer("automation_accuracy_percent").default(0).notNull(),
  falsePositiveRate: integer("false_positive_rate_percent").default(0).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===== END ENHANCED MODERATION SYSTEM TABLES =====

// Zod schemas for validation
export const insertInviteCodeSchema = createInsertSchema(inviteCodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
});

export const insertReferralRewardSchema = createInsertSchema(referralRewards).omit({
  id: true,
  createdAt: true,
});

export const insertReferralMilestoneSchema = createInsertSchema(referralMilestones).omit({
  id: true,
  achievedAt: true,
});

export const insertInviteAnalyticsSchema = createInsertSchema(inviteAnalytics).omit({
  id: true,
  timestamp: true,
});

export const insertReferralLeaderboardSchema = createInsertSchema(referralLeaderboards).omit({
  id: true,
  createdAt: true,
});

export type InsertInviteCodeType = z.infer<typeof insertInviteCodeSchema>;
export type InsertReferralType = z.infer<typeof insertReferralSchema>;
export type InsertReferralRewardType = z.infer<typeof insertReferralRewardSchema>;
export type InsertReferralMilestoneType = z.infer<typeof insertReferralMilestoneSchema>;
export type InsertInviteAnalyticsType = z.infer<typeof insertInviteAnalyticsSchema>;
export type InsertReferralLeaderboardType = z.infer<typeof insertReferralLeaderboardSchema>;

// Invite code validation response type
export type InviteCodeValidation = {
  valid: boolean;
  reason?: string;
  inviteCode?: InviteCodeWithStats;
};

// ===== ENHANCED MODERATION SYSTEM SCHEMAS =====

// Moderation table schemas
export const insertModerationAnalysisSchema = createInsertSchema(moderationAnalysis).omit({
  id: true,
  createdAt: true,
});

export const insertModerationActionSchema = createInsertSchema(moderationActions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserTrustScoreSchema = createInsertSchema(userTrustScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastCalculatedAt: true,
});

export const insertEnhancedReportSchema = createInsertSchema(enhancedReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContentSimilaritySchema = createInsertSchema(contentSimilarity).omit({
  id: true,
  createdAt: true,
});

export const insertModerationQueueSchema = createInsertSchema(moderationQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertModerationAppealSchema = createInsertSchema(moderationAppeals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertModerationStatsSchema = createInsertSchema(moderationStats).omit({
  id: true,
  createdAt: true,
});

// Enhanced moderation types
export type ModerationAnalysis = typeof moderationAnalysis.$inferSelect;
export type InsertModerationAnalysis = z.infer<typeof insertModerationAnalysisSchema>;

export type ModerationAction = typeof moderationActions.$inferSelect;
export type InsertModerationAction = z.infer<typeof insertModerationActionSchema>;

export type UserTrustScore = typeof userTrustScores.$inferSelect;
export type InsertUserTrustScore = z.infer<typeof insertUserTrustScoreSchema>;

export type EnhancedReport = typeof enhancedReports.$inferSelect;
export type InsertEnhancedReport = z.infer<typeof insertEnhancedReportSchema>;

export type ContentSimilarity = typeof contentSimilarity.$inferSelect;
export type InsertContentSimilarity = z.infer<typeof insertContentSimilaritySchema>;

export type ModerationQueue = typeof moderationQueue.$inferSelect;
export type InsertModerationQueue = z.infer<typeof insertModerationQueueSchema>;

export type ModerationAppeal = typeof moderationAppeals.$inferSelect;
export type InsertModerationAppeal = z.infer<typeof insertModerationAppealSchema>;

export type ModerationStats = typeof moderationStats.$inferSelect;
export type InsertModerationStats = z.infer<typeof insertModerationStatsSchema>;

// Composite types for moderation system
export type ModerationQueueItem = ModerationQueue & {
  analysis?: ModerationAnalysis;
  content?: {
    id: string;
    text: string;
    author?: {
      id: string;
      handle: string;
      trustScore?: UserTrustScore;
    };
  };
  reports?: EnhancedReport[];
};

export type ModerationDashboard = {
  totalPending: number;
  highPriority: number;
  avgReviewTime: number;
  automationAccuracy: number;
  recentActions: ModerationAction[];
  queueItems: ModerationQueueItem[];
  stats: ModerationStats;
};

export type UserModerationProfile = {
  human: Human;
  trustScore: UserTrustScore;
  recentActions: ModerationAction[];
  reportHistory: {
    made: EnhancedReport[];
    received: EnhancedReport[];
  };
  appeals: ModerationAppeal[];
};

export type ContentModerationResult = {
  analysis: ModerationAnalysis;
  action?: ModerationAction;
  queueItem?: ModerationQueue;
  similarity?: ContentSimilarity;
};

export type ModerationAppealRequest = {
  originalActionId: string;
  reason: string;
  additionalContext?: string;
};

export type ModerationReviewAction = {
  contentId: string;
  action: 'approve' | 'warn' | 'hide' | 'delete' | 'ban_user';
  reason: string;
  duration?: number; // hours for temporary actions
  notes?: string;
};

export type ModerationAnalytics = {
  period: 'day' | 'week' | 'month';
  totalContent: number;
  flaggedContent: number;
  automatedActions: number;
  humanReviews: number;
  falsePositiveRate: number;
  avgReviewTime: number;
  topViolations: { type: string; count: number }[];
  trustedUsers: number;
  suspendedUsers: number;
};

// ===== ADMIN SYSTEM TABLES =====

// System configuration for feature flags and app settings
export const systemConfigurations = pgTable("system_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(), // e.g., 'feature_token_distribution', 'max_messages_per_day'
  value: text("value").notNull(), // JSON string for complex values
  valueType: varchar("value_type", { enum: ["string", "number", "boolean", "json"] }).notNull(),
  category: varchar("category", { enum: ["feature_flags", "rate_limits", "ui_settings", "moderation", "token_system"] }).notNull(),
  description: text("description"),
  isPublic: boolean("is_public").default(false).notNull(), // Whether setting is visible to regular users
  updatedBy: varchar("updated_by").references(() => humans.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Admin action audit log
export const adminActionLogs = pgTable("admin_action_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => humans.id),
  action: varchar("action").notNull(), // e.g., 'user_ban', 'message_delete', 'config_update'
  resourceType: varchar("resource_type", { enum: ["user", "message", "topic", "config", "moderation", "system"] }).notNull(),
  resourceId: varchar("resource_id"), // ID of the affected resource
  details: jsonb("details").$type<{
    before?: any;
    after?: any;
    reason?: string;
    metadata?: any;
  }>().default({}).notNull(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  severity: varchar("severity", { enum: ["low", "medium", "high", "critical"] }).notNull().default("medium"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Admin roles and permissions
export const adminRoles = pgTable("admin_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(), // e.g., 'super_admin', 'moderator', 'content_admin'
  displayName: text("display_name").notNull(),
  description: text("description"),
  permissions: jsonb("permissions").$type<string[]>().default([]).notNull(), // Array of permission strings
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Admin user assignments
export const adminUserRoles = pgTable("admin_user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  humanId: varchar("human_id").notNull().references(() => humans.id),
  roleId: varchar("role_id").notNull().references(() => adminRoles.id),
  assignedBy: varchar("assigned_by").notNull().references(() => humans.id),
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at"), // Optional expiration for temporary admin access
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// System health metrics and monitoring
export const systemHealthMetrics = pgTable("system_health_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  metricType: varchar("metric_type", { 
    enum: ["response_time", "database_health", "queue_size", "error_rate", "memory_usage", "cpu_usage"] 
  }).notNull(),
  value: integer("value").notNull(), // Numeric value of the metric
  unit: varchar("unit", { enum: ["ms", "percent", "count", "mb", "bytes"] }).notNull(),
  status: varchar("status", { enum: ["healthy", "warning", "critical"] }).notNull().default("healthy"),
  details: jsonb("details").$type<{
    source?: string;
    threshold?: number;
    context?: any;
  }>().default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User analytics aggregated data
export const userAnalytics = pgTable("user_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: varchar("date").notNull(), // YYYY-MM-DD format
  
  // User growth metrics
  totalUsers: integer("total_users").default(0).notNull(),
  newUsers: integer("new_users").default(0).notNull(),
  activeUsers: integer("active_users").default(0).notNull(),
  returningUsers: integer("returning_users").default(0).notNull(),
  
  // Engagement metrics
  totalMessages: integer("total_messages").default(0).notNull(),
  avgMessagesPerUser: integer("avg_messages_per_user").default(0).notNull(),
  totalStars: integer("total_stars").default(0).notNull(),
  avgStarsPerMessage: integer("avg_stars_per_message").default(0).notNull(),
  
  // Room breakdown
  globalRoomMessages: integer("global_room_messages").default(0).notNull(),
  workRoomMessages: integer("work_room_messages").default(0).notNull(),
  
  // Trust and moderation
  trustedUsers: integer("trusted_users").default(0).notNull(),
  flaggedUsers: integer("flagged_users").default(0).notNull(),
  moderationActions: integer("moderation_actions").default(0).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Content analytics aggregated data
export const contentAnalytics = pgTable("content_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: varchar("date").notNull(), // YYYY-MM-DD format
  
  // Message metrics
  totalMessages: integer("total_messages").default(0).notNull(),
  approvedMessages: integer("approved_messages").default(0).notNull(),
  flaggedMessages: integer("flagged_messages").default(0).notNull(),
  deletedMessages: integer("deleted_messages").default(0).notNull(),
  
  // Engagement metrics
  totalStars: integer("total_stars").default(0).notNull(),
  totalReports: integer("total_reports").default(0).notNull(),
  avgEngagementScore: integer("avg_engagement_score").default(0).notNull(),
  
  // Topic performance
  topicId: varchar("topic_id").references(() => topics.id),
  topicEngagement: integer("topic_engagement").default(0).notNull(),
  
  // Content categories
  helpMessages: integer("help_messages").default(0).notNull(),
  adviceMessages: integer("advice_messages").default(0).notNull(),
  collabMessages: integer("collab_messages").default(0).notNull(),
  
  // Quality metrics
  highQualityMessages: integer("high_quality_messages").default(0).notNull(),
  lowQualityMessages: integer("low_quality_messages").default(0).notNull(),
  spamMessages: integer("spam_messages").default(0).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Enhanced user profiles for admin management
export const enhancedUserProfiles = pgTable("enhanced_user_profiles", {
  humanId: varchar("human_id").primaryKey().references(() => humans.id),
  
  // Basic profile info
  displayName: varchar("display_name", { length: 50 }),
  bio: text("bio"),
  location: varchar("location", { length: 100 }),
  website: varchar("website"),
  
  // Account status
  isVerified: boolean("is_verified").default(false).notNull(),
  verificationLevel: varchar("verification_level", { 
    enum: ["none", "basic", "enhanced", "premium"] 
  }).default("none").notNull(),
  accountStatus: varchar("account_status", { 
    enum: ["active", "warned", "restricted", "suspended", "banned"] 
  }).default("active").notNull(),
  
  // Trust and reputation
  trustLevel: varchar("trust_level", { 
    enum: ["new", "basic", "trusted", "veteran", "moderator"] 
  }).default("new").notNull(),
  reputationScore: integer("reputation_score").default(0).notNull(),
  
  // Activity metrics
  totalMessages: integer("total_messages").default(0).notNull(),
  totalStars: integer("total_stars").default(0).notNull(),
  helpfulMessages: integer("helpful_messages").default(0).notNull(),
  reportedMessages: integer("reported_messages").default(0).notNull(),
  daysActive: integer("days_active").default(0).notNull(),
  streakDays: integer("streak_days").default(0).notNull(),
  
  // Moderation info
  warningsCount: integer("warnings_count").default(0).notNull(),
  suspensionsCount: integer("suspensions_count").default(0).notNull(),
  lastViolation: timestamp("last_violation"),
  moderationNotes: text("moderation_notes"),
  
  // Admin metadata
  notes: text("notes"), // Admin notes about the user
  tags: jsonb("tags").$type<string[]>().default([]).notNull(), // Admin tags
  lastReviewedBy: varchar("last_reviewed_by").references(() => humans.id),
  lastReviewedAt: timestamp("last_reviewed_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Bulk admin operations log
export const bulkOperations = pgTable("bulk_operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  operatorId: varchar("operator_id").notNull().references(() => humans.id),
  operationType: varchar("operation_type", { 
    enum: ["bulk_ban", "bulk_warn", "bulk_delete", "bulk_approve", "bulk_export"] 
  }).notNull(),
  targetType: varchar("target_type", { enum: ["users", "messages", "topics"] }).notNull(),
  criteria: jsonb("criteria").$type<{
    filters?: any;
    dateRange?: { start: string; end: string };
    userList?: string[];
    messageList?: string[];
  }>().notNull(),
  
  // Execution details
  status: varchar("status", { enum: ["pending", "processing", "completed", "failed"] }).default("pending").notNull(),
  totalTargets: integer("total_targets").default(0).notNull(),
  processedTargets: integer("processed_targets").default(0).notNull(),
  successfulTargets: integer("successful_targets").default(0).notNull(),
  failedTargets: integer("failed_targets").default(0).notNull(),
  
  // Results
  results: jsonb("results").$type<{
    errors?: string[];
    warnings?: string[];
    summary?: any;
  }>().default({}).notNull(),
  
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// System notifications for admins
export const systemNotifications = pgTable("system_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { 
    enum: ["security_alert", "system_health", "moderation_alert", "user_milestone", "performance_issue"] 
  }).notNull(),
  severity: varchar("severity", { enum: ["info", "warning", "error", "critical"] }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<{
    resourceId?: string;
    resourceType?: string;
    actionRequired?: boolean;
    autoResolve?: boolean;
  }>().default({}).notNull(),
  
  // Targeting
  targetRoles: jsonb("target_roles").$type<string[]>().default([]).notNull(), // Which admin roles should see this
  isRead: boolean("is_read").default(false).notNull(),
  readBy: jsonb("read_by").$type<string[]>().default([]).notNull(), // Array of admin IDs who read it
  
  // Resolution
  isResolved: boolean("is_resolved").default(false).notNull(),
  resolvedBy: varchar("resolved_by").references(() => humans.id),
  resolvedAt: timestamp("resolved_at"),
  
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===== ADMIN SYSTEM SCHEMAS =====

export const insertSystemConfigurationSchema = createInsertSchema(systemConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminActionLogSchema = createInsertSchema(adminActionLogs).omit({
  id: true,
  createdAt: true,
});

export const insertAdminRoleSchema = createInsertSchema(adminRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminUserRoleSchema = createInsertSchema(adminUserRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemHealthMetricSchema = createInsertSchema(systemHealthMetrics).omit({
  id: true,
  timestamp: true,
  createdAt: true,
});

export const insertUserAnalyticsSchema = createInsertSchema(userAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertContentAnalyticsSchema = createInsertSchema(contentAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertEnhancedUserProfileSchema = createInsertSchema(enhancedUserProfiles).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertBulkOperationSchema = createInsertSchema(bulkOperations).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
});

export const insertSystemNotificationSchema = createInsertSchema(systemNotifications).omit({
  id: true,
  createdAt: true,
});

// Admin system types
export type SystemConfiguration = typeof systemConfigurations.$inferSelect;
export type InsertSystemConfiguration = z.infer<typeof insertSystemConfigurationSchema>;

export type AdminActionLog = typeof adminActionLogs.$inferSelect;
export type InsertAdminActionLog = z.infer<typeof insertAdminActionLogSchema>;

export type AdminRole = typeof adminRoles.$inferSelect;
export type InsertAdminRole = z.infer<typeof insertAdminRoleSchema>;

export type AdminUserRole = typeof adminUserRoles.$inferSelect;
export type InsertAdminUserRole = z.infer<typeof insertAdminUserRoleSchema>;

export type SystemHealthMetric = typeof systemHealthMetrics.$inferSelect;
export type InsertSystemHealthMetric = z.infer<typeof insertSystemHealthMetricSchema>;

export type UserAnalytics = typeof userAnalytics.$inferSelect;
export type InsertUserAnalytics = z.infer<typeof insertUserAnalyticsSchema>;

export type ContentAnalytics = typeof contentAnalytics.$inferSelect;
export type InsertContentAnalytics = z.infer<typeof insertContentAnalyticsSchema>;

export type EnhancedUserProfile = typeof enhancedUserProfiles.$inferSelect;
export type InsertEnhancedUserProfile = z.infer<typeof insertEnhancedUserProfileSchema>;

export type BulkOperation = typeof bulkOperations.$inferSelect;
export type InsertBulkOperation = z.infer<typeof insertBulkOperationSchema>;

export type SystemNotification = typeof systemNotifications.$inferSelect;
export type InsertSystemNotification = z.infer<typeof insertSystemNotificationSchema>;

// Composite admin types
export type AdminDashboardData = {
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    responseTime: number;
    errorRate: number;
    activeUsers: number;
  };
  userMetrics: {
    totalUsers: number;
    newUsersToday: number;
    activeUsersToday: number;
    trustedUsers: number;
    flaggedUsers: number;
  };
  contentMetrics: {
    totalMessages: number;
    messagesToday: number;
    flaggedContent: number;
    pendingReviews: number;
    automationAccuracy: number;
  };
  moderationQueue: {
    pending: number;
    inReview: number;
    highPriority: number;
    avgReviewTime: number;
  };
  recentActivity: AdminActionLog[];
  systemNotifications: SystemNotification[];
};

export type UserManagementFilters = {
  search?: string;
  trustLevel?: string;
  accountStatus?: string;
  verificationLevel?: string;
  dateRange?: { start: string; end: string };
  hasViolations?: boolean;
  isOnline?: boolean;
};

export type UserManagementResult = {
  users: (EnhancedUserProfile & { 
    human: Human; 
    trustScore?: UserTrustScore;
    recentActivity?: { lastMessage: Date; messagesLast24h: number };
  })[];
  total: number;
  filters: UserManagementFilters;
};

export type ContentManagementFilters = {
  search?: string;
  room?: string;
  category?: string;
  status?: string;
  dateRange?: { start: string; end: string };
  authorTrustLevel?: string;
  hasReports?: boolean;
  starCount?: { min?: number; max?: number };
};

export type ContentManagementResult = {
  messages: (Message & { 
    author: Human & { profile?: EnhancedUserProfile };
    reports?: EnhancedReport[];
    moderationAnalysis?: ModerationAnalysis;
  })[];
  total: number;
  filters: ContentManagementFilters;
};

export type SystemAdminSettings = {
  features: { [key: string]: boolean };
  rateLimits: { [key: string]: number };
  moderationSettings: { [key: string]: any };
  uiSettings: { [key: string]: any };
};

export type SecurityAuditData = {
  recentActions: AdminActionLog[];
  failedLogins: { count: number; ips: string[] };
  suspiciousActivity: { type: string; details: any; count: number }[];
  permissions: { role: string; permissions: string[] }[];
};

export type AnalyticsDashboardData = {
  userGrowth: { date: string; newUsers: number; totalUsers: number }[];
  engagement: { date: string; messages: number; stars: number; activeUsers: number }[];
  contentPerformance: { topic: string; engagement: number; messages: number }[];
  moderationEffectiveness: { date: string; accuracy: number; falsePositives: number; reviewTime: number }[];
  communityHealth: {
    trustDistribution: { level: string; count: number }[];
    topContributors: { user: string; score: number }[];
    violationTrends: { date: string; count: number }[];
  };
};

// ===== END ENHANCED MODERATION SYSTEM SCHEMAS =====
