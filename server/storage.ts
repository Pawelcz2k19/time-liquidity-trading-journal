import { trades, journalEntries, playbooks, settings } from '@shared/schema';
import type {
  Trade, InsertTrade,
  JournalEntry, InsertJournal,
  Playbook, InsertPlaybook,
  Settings, InsertSettings,
} from '@shared/schema';
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, sql } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Ensure tables exist (idempotent — runs every boot)
sqlite.exec(`
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  time_entry TEXT NOT NULL,
  time_exit TEXT,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'closed',
  entry_price REAL NOT NULL,
  exit_price REAL,
  stop_price REAL NOT NULL,
  target_price REAL,
  quantity REAL NOT NULL,
  point_value REAL NOT NULL DEFAULT 20,
  points_result REAL,
  gross_pnl REAL,
  fees_total REAL DEFAULT 0,
  net_pnl REAL,
  r_multiple REAL,
  risk_dollars REAL,
  playbook_id INTEGER,
  setup_tags TEXT DEFAULT '[]',
  mistake_tags TEXT DEFAULT '[]',
  emotion_tags TEXT DEFAULT '[]',
  within_window INTEGER DEFAULT 1,
  followed_plan INTEGER DEFAULT 1,
  four_four_check INTEGER DEFAULT 0,
  moved_stop_too_early INTEGER DEFAULT 0,
  scaled_properly INTEGER DEFAULT 0,
  rating INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  screenshot_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(date);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  bias TEXT DEFAULT '',
  trigger_zone TEXT DEFAULT '',
  stop_out_rules TEXT DEFAULT '',
  checked_news INTEGER DEFAULT 0,
  reviewed_htf INTEGER DEFAULT 0,
  marked_levels INTEGER DEFAULT 0,
  noted_onh_onl INTEGER DEFAULT 0,
  set_alerts INTEGER DEFAULT 0,
  what_worked TEXT DEFAULT '',
  what_to_improve TEXT DEFAULT '',
  biggest_mistake TEXT DEFAULT '',
  one_thing_tomorrow TEXT DEFAULT '',
  flat_by_1015 INTEGER DEFAULT 0,
  respected_3r INTEGER DEFAULT 0,
  three_idea_max INTEGER DEFAULT 0,
  mood INTEGER DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playbooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  rules TEXT DEFAULT '[]',
  checklist TEXT DEFAULT '[]',
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_size REAL DEFAULT 10000,
  rpt_percent REAL DEFAULT 1.0,
  default_symbol TEXT DEFAULT 'MNQ',
  default_point_value REAL DEFAULT 2.0,
  default_fee_per_contract REAL DEFAULT 0.5,
  currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'America/New_York'
);
`);

// Helpers to compute derived fields
function computeDerived(t: Partial<InsertTrade> & { entryPrice: number; stopPrice: number; quantity: number; pointValue: number; direction: string; exitPrice?: number | null; feesTotal?: number | null; }) {
  const dir = t.direction === 'long' ? 1 : -1;
  const riskPerUnit = Math.abs(t.entryPrice - t.stopPrice);
  const riskDollars = riskPerUnit * t.pointValue * t.quantity;

  if (t.exitPrice == null) {
    return { pointsResult: null, grossPnl: null, netPnl: null, rMultiple: null, riskDollars };
  }
  const pointsResult = (t.exitPrice - t.entryPrice) * dir;
  const grossPnl = pointsResult * t.pointValue * t.quantity;
  const netPnl = grossPnl - (t.feesTotal ?? 0);
  const rMultiple = riskPerUnit > 0 ? pointsResult / riskPerUnit : 0;
  return { pointsResult, grossPnl, netPnl, rMultiple, riskDollars };
}

// Seed default playbooks + settings on first run
function seedDefaults() {
  const existing = db.select().from(settings).all();
  if (existing.length === 0) {
    db.insert(settings).values({
      accountSize: 10000,
      rptPercent: 1.0,
      defaultSymbol: 'MNQ',
      defaultPointValue: 2.0,
      defaultFeePerContract: 0.5,
      currency: 'USD',
      timezone: 'America/New_York',
    }).run();
  }
  const existingPb = db.select().from(playbooks).all();
  if (existingPb.length === 0) {
    const defaults = [
      {
        name: 'VWAP Reclaim Long',
        description: 'Price drops below VWAP, then reclaims with strong volume inside the 9:30-10:15 window. Long entry on the reclaim candle close.',
        rules: JSON.stringify([
          'Within 9:30-10:15 ET window',
          'Price reclaimed VWAP with above-avg volume',
          'SPY/QQQ confirming the same direction',
          'Higher-timeframe bias aligned with long',
        ]),
        checklist: JSON.stringify([
          '4/4 alignment confirmed (bias/SPY/VWAP/PA)',
          'Stop placed below reclaim swing low',
          'First target = 30-40 points',
          'Ultimate target = 50-150 points',
        ]),
      },
      {
        name: 'Opening Range Breakout',
        description: 'Mark the 9:30-9:35 range. Wait for clean break and retest with continuation candle.',
        rules: JSON.stringify([
          'Open at 9:30 ET; 5-min range defined',
          'Break of range with volume',
          'Successful retest of broken level',
          'No major news in the next 15 minutes',
        ]),
        checklist: JSON.stringify([
          'Range high/low marked',
          'Volume on break confirmed',
          'Retest held the level',
          'Stop just inside the broken range',
        ]),
      },
      {
        name: 'Opening Drive Fade',
        description: 'Aggressive open in one direction stalls into a major level (ONH/ONL, prior day high/low). Fade back to VWAP.',
        rules: JSON.stringify([
          'Strong directional open',
          'Reaching a key prior level',
          'Failure pattern (sweep + close back inside)',
          'Diverging delta or footprint absorption',
        ]),
        checklist: JSON.stringify([
          'Major level identified pre-market',
          'Failure pattern confirmed',
          'Stop above/below the swept level',
          'Target = VWAP',
        ]),
      },
    ];
    for (const p of defaults) db.insert(playbooks).values(p).run();
  }
}
seedDefaults();

export interface IStorage {
  // Trades
  listTrades(): Promise<Trade[]>;
  getTrade(id: number): Promise<Trade | undefined>;
  createTrade(t: InsertTrade): Promise<Trade>;
  updateTrade(id: number, t: Partial<InsertTrade>): Promise<Trade | undefined>;
  deleteTrade(id: number): Promise<void>;

  // Journal
  listJournals(): Promise<JournalEntry[]>;
  getJournalByDate(date: string): Promise<JournalEntry | undefined>;
  upsertJournal(entry: InsertJournal): Promise<JournalEntry>;
  deleteJournal(id: number): Promise<void>;

  // Playbooks
  listPlaybooks(): Promise<Playbook[]>;
  createPlaybook(p: InsertPlaybook): Promise<Playbook>;
  updatePlaybook(id: number, p: Partial<InsertPlaybook>): Promise<Playbook | undefined>;
  deletePlaybook(id: number): Promise<void>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(s: Partial<InsertSettings>): Promise<Settings>;

  // Export / Import
  exportAll(): Promise<{ trades: Trade[]; journals: JournalEntry[]; playbooks: Playbook[]; settings: Settings; exportedAt: string; }>;
  importAll(data: { trades?: any[]; journals?: any[]; playbooks?: any[]; settings?: any; mode: 'merge' | 'replace'; }): Promise<{ trades: number; journals: number; playbooks: number; }>;
}

export class DatabaseStorage implements IStorage {
  // ===== Trades =====
  async listTrades(): Promise<Trade[]> {
    return db.select().from(trades).orderBy(desc(trades.date), desc(trades.timeEntry)).all();
  }
  async getTrade(id: number): Promise<Trade | undefined> {
    return db.select().from(trades).where(eq(trades.id, id)).get();
  }
  async createTrade(t: InsertTrade): Promise<Trade> {
    const derived = computeDerived(t as any);
    return db.insert(trades).values({ ...t, ...derived }).returning().get();
  }
  async updateTrade(id: number, t: Partial<InsertTrade>): Promise<Trade | undefined> {
    const current = await this.getTrade(id);
    if (!current) return undefined;
    const merged: any = { ...current, ...t };
    const derived = computeDerived(merged);
    await db.update(trades).set({ ...t, ...derived }).where(eq(trades.id, id)).run();
    return this.getTrade(id);
  }
  async deleteTrade(id: number): Promise<void> {
    db.delete(trades).where(eq(trades.id, id)).run();
  }

  // ===== Journal =====
  async listJournals(): Promise<JournalEntry[]> {
    return db.select().from(journalEntries).orderBy(desc(journalEntries.date)).all();
  }
  async getJournalByDate(date: string): Promise<JournalEntry | undefined> {
    return db.select().from(journalEntries).where(eq(journalEntries.date, date)).get();
  }
  async upsertJournal(entry: InsertJournal): Promise<JournalEntry> {
    const existing = await this.getJournalByDate(entry.date);
    if (existing) {
      await db.update(journalEntries).set(entry).where(eq(journalEntries.id, existing.id)).run();
      return (await this.getJournalByDate(entry.date))!;
    }
    return db.insert(journalEntries).values(entry).returning().get();
  }
  async deleteJournal(id: number): Promise<void> {
    db.delete(journalEntries).where(eq(journalEntries.id, id)).run();
  }

  // ===== Playbooks =====
  async listPlaybooks(): Promise<Playbook[]> {
    return db.select().from(playbooks).orderBy(desc(playbooks.id)).all();
  }
  async createPlaybook(p: InsertPlaybook): Promise<Playbook> {
    return db.insert(playbooks).values(p).returning().get();
  }
  async updatePlaybook(id: number, p: Partial<InsertPlaybook>): Promise<Playbook | undefined> {
    await db.update(playbooks).set(p).where(eq(playbooks.id, id)).run();
    return db.select().from(playbooks).where(eq(playbooks.id, id)).get();
  }
  async deletePlaybook(id: number): Promise<void> {
    db.delete(playbooks).where(eq(playbooks.id, id)).run();
  }

  // ===== Settings =====
  async getSettings(): Promise<Settings> {
    const row = db.select().from(settings).get();
    if (row) return row;
    return db.insert(settings).values({}).returning().get();
  }
  async updateSettings(s: Partial<InsertSettings>): Promise<Settings> {
    const current = await this.getSettings();
    await db.update(settings).set(s).where(eq(settings.id, current.id)).run();
    return this.getSettings();
  }

  // ===== Export / Import =====
  async exportAll() {
    return {
      trades: await this.listTrades(),
      journals: await this.listJournals(),
      playbooks: await this.listPlaybooks(),
      settings: await this.getSettings(),
      exportedAt: new Date().toISOString(),
    };
  }
  async importAll(data: { trades?: any[]; journals?: any[]; playbooks?: any[]; settings?: any; mode: 'merge' | 'replace'; }) {
    if (data.mode === 'replace') {
      db.delete(trades).run();
      db.delete(journalEntries).run();
      db.delete(playbooks).run();
    }
    let t = 0, j = 0, p = 0;
    for (const tr of data.trades ?? []) {
      const { id, createdAt, ...rest } = tr;
      const derived = computeDerived(rest);
      db.insert(trades).values({ ...rest, ...derived }).run();
      t++;
    }
    for (const je of data.journals ?? []) {
      const { id, createdAt, ...rest } = je;
      const existing = await this.getJournalByDate(rest.date);
      if (existing) {
        db.update(journalEntries).set(rest).where(eq(journalEntries.id, existing.id)).run();
      } else {
        db.insert(journalEntries).values(rest).run();
      }
      j++;
    }
    for (const pb of data.playbooks ?? []) {
      const { id, createdAt, ...rest } = pb;
      db.insert(playbooks).values(rest).run();
      p++;
    }
    if (data.settings) {
      const { id, ...rest } = data.settings;
      await this.updateSettings(rest);
    }
    return { trades: t, journals: j, playbooks: p };
  }
}

export const storage = new DatabaseStorage();
