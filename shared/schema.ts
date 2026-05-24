import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== TRADES =====
// One row per executed trade. The course strategy emphasizes R-multiples,
// 4-phase management, and the 9:30-10:15 ET window.
export const trades = sqliteTable("trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  // Identification
  date: text("date").notNull(), // ISO yyyy-mm-dd
  timeEntry: text("time_entry").notNull(), // HH:MM (24h, ET)
  timeExit: text("time_exit"), // HH:MM (24h, ET) — null while open
  symbol: text("symbol").notNull(), // NQ, MNQ, QQQ, NAS100, US100, ES, MES, custom
  direction: text("direction").notNull(), // 'long' | 'short'
  status: text("status").notNull().default("closed"), // 'open' | 'closed'

  // Prices & size
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  stopPrice: real("stop_price").notNull(),
  targetPrice: real("target_price"),
  quantity: real("quantity").notNull(), // contracts/shares
  pointValue: real("point_value").notNull().default(20), // $ per point (NQ=20, MNQ=2, ES=50, MES=5)

  // Derived results (stored for fast querying; recomputed on save)
  pointsResult: real("points_result"), // exit - entry (signed by direction)
  grossPnl: real("gross_pnl"),         // pointsResult * pointValue * quantity
  feesTotal: real("fees_total").default(0),
  netPnl: real("net_pnl"),             // grossPnl - feesTotal
  rMultiple: real("r_multiple"),       // pointsResult / |entry-stop|
  riskDollars: real("risk_dollars"),   // |entry-stop| * pointValue * quantity (initial)

  // Course-strategy fields
  playbookId: integer("playbook_id"), // FK to playbooks.id
  setupTags: text("setup_tags").default("[]"),     // JSON: ["VWAP reclaim", "Opening drive", ...]
  mistakeTags: text("mistake_tags").default("[]"), // JSON: ["FOMO", "Moved stop early", ...]
  emotionTags: text("emotion_tags").default("[]"), // JSON: ["Calm", "Revenge", ...]

  // Course rule compliance (booleans stored as integers)
  withinWindow: integer("within_window").default(1),   // 9:30-10:15 ET
  followedPlan: integer("followed_plan").default(1),
  fourFourCheck: integer("four_four_check").default(0), // bias/SPY/VWAP/PA all aligned
  movedStopTooEarly: integer("moved_stop_too_early").default(0),
  scaledProperly: integer("scaled_properly").default(0), // 20→50→100

  // Qualitative
  rating: integer("rating").default(0), // 0-5 stars (trade quality)
  notes: text("notes").default(""),
  screenshotUrl: text("screenshot_url"), // base64 data URL or file path

  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  createdAt: true,
  pointsResult: true,
  grossPnl: true,
  netPnl: true,
  rMultiple: true,
  riskDollars: true,
});
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

// ===== DAILY JOURNAL =====
// One entry per session — pre-market plan and post-session reflection.
// Mirrors Module 12 of the course.
export const journalEntries = sqliteTable("journal_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(), // one per day

  // Pre-market (Module 12 Lesson 1) — written by 9:30 ET
  bias: text("bias").default(""),         // long / short / no-trade + reasoning
  triggerZone: text("trigger_zone").default(""), // specific level + confirmation
  stopOutRules: text("stop_out_rules").default(""), // when day ends

  // Pre-market checklist (booleans as ints)
  checkedNews: integer("checked_news").default(0),
  reviewedHTF: integer("reviewed_htf").default(0),     // 1H/4H
  markedLevels: integer("marked_levels").default(0),
  notedONH_ONL: integer("noted_onh_onl").default(0),
  setAlerts: integer("set_alerts").default(0),

  // Post-session (Module 12 Lesson 4)
  whatWorked: text("what_worked").default(""),
  whatToImprove: text("what_to_improve").default(""),
  biggestMistake: text("biggest_mistake").default(""),
  oneThingTomorrow: text("one_thing_tomorrow").default(""),

  // Discipline tracking
  flatBy1015: integer("flat_by_1015").default(0),
  respected3R: integer("respected_3r").default(0),
  threeIdeaMax: integer("three_idea_max").default(0),
  mood: integer("mood").default(3), // 1-5 (1=poor, 5=excellent)

  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const insertJournalSchema = createInsertSchema(journalEntries).omit({
  id: true,
  createdAt: true,
});
export type InsertJournal = z.infer<typeof insertJournalSchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;

// ===== PLAYBOOKS =====
// Named setups with rules. Each trade can be linked to one playbook.
export const playbooks = sqliteTable("playbooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").default(""),
  rules: text("rules").default("[]"),       // JSON: ["Within 9:30-10:15 ET", "VWAP reclaim with volume", ...]
  checklist: text("checklist").default("[]"), // JSON: ["4/4 alignment confirmed", ...]
  active: integer("active").default(1),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const insertPlaybookSchema = createInsertSchema(playbooks).omit({
  id: true,
  createdAt: true,
});
export type InsertPlaybook = z.infer<typeof insertPlaybookSchema>;
export type Playbook = typeof playbooks.$inferSelect;

// ===== SETTINGS =====
// Single-row table for account-level configuration.
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountSize: real("account_size").default(10000),
  rptPercent: real("rpt_percent").default(1.0), // risk per trade %
  defaultSymbol: text("default_symbol").default("MNQ"),
  defaultPointValue: real("default_point_value").default(2.0),
  defaultFeePerContract: real("default_fee_per_contract").default(0.5),
  currency: text("currency").default("USD"),
  timezone: text("timezone").default("America/New_York"),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
