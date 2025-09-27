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

// Theme/topic of the day
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
});

export const insertStarSchema = createInsertSchema(stars).omit({
  createdAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
});

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
});

// Types
export type InsertHuman = z.infer<typeof insertHumanSchema>;
export type Human = typeof humans.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertStar = z.infer<typeof insertStarSchema>;
export type Star = typeof stars.$inferSelect;

export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

export type InsertTheme = z.infer<typeof insertThemeSchema>;
export type Theme = typeof themes.$inferSelect;

export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;

export type InsertConnectRequest = z.infer<typeof insertConnectRequestSchema>;
export type ConnectRequest = typeof connectRequests.$inferSelect;

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
};

export type OnlinePresence = {
  count: number;
  roundedCount: string;
};
