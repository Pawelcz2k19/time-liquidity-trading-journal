// Pure stat computations from a list of closed trades.
import type { Trade, JournalEntry } from "@shared/schema";
import { parseTags } from "./format";

export interface KPIs {
  netPnl: number;
  grossPnl: number;
  totalFees: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  scratchCount: number;
  winRate: number;        // 0..1
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;   // sum wins / |sum losses|
  expectancy: number;     // avg P&L per trade ($)
  expectancyR: number;    // avg R per trade
  totalR: number;
  avgR: number;
  maxDrawdown: number;    // peak-to-trough $
  maxDrawdownPct: number; // 0..1
  currentStreak: number;  // + win streak / - loss streak
  bestDay: number;
  worstDay: number;
}

export function closedTrades(trades: Trade[]): Trade[] {
  return trades.filter(t => t.status === "closed" && t.netPnl != null);
}

export function computeKPIs(trades: Trade[]): KPIs {
  const ts = closedTrades(trades);
  if (ts.length === 0) {
    return {
      netPnl: 0, grossPnl: 0, totalFees: 0, tradeCount: 0,
      winCount: 0, lossCount: 0, scratchCount: 0, winRate: 0,
      avgWin: 0, avgLoss: 0, largestWin: 0, largestLoss: 0,
      profitFactor: 0, expectancy: 0, expectancyR: 0, totalR: 0, avgR: 0,
      maxDrawdown: 0, maxDrawdownPct: 0, currentStreak: 0, bestDay: 0, worstDay: 0,
    };
  }
  let net = 0, gross = 0, fees = 0;
  let wins = 0, losses = 0, scratches = 0;
  let sumWins = 0, sumLosses = 0;
  let largestWin = 0, largestLoss = 0;
  let totalR = 0;
  for (const t of ts) {
    const pl = t.netPnl ?? 0;
    net += pl;
    gross += t.grossPnl ?? 0;
    fees += t.feesTotal ?? 0;
    totalR += t.rMultiple ?? 0;
    if (pl > 0) { wins++; sumWins += pl; if (pl > largestWin) largestWin = pl; }
    else if (pl < 0) { losses++; sumLosses += pl; if (pl < largestLoss) largestLoss = pl; }
    else scratches++;
  }
  const tradeCount = ts.length;
  const winRate = wins / tradeCount;
  const avgWin = wins ? sumWins / wins : 0;
  const avgLoss = losses ? sumLosses / losses : 0;
  const profitFactor = sumLosses !== 0 ? sumWins / Math.abs(sumLosses) : (sumWins > 0 ? Infinity : 0);
  const expectancy = net / tradeCount;
  const avgR = totalR / tradeCount;

  // Drawdown — chronological order
  const chrono = [...ts].sort((a, b) => (a.date + a.timeEntry).localeCompare(b.date + b.timeEntry));
  let peak = 0, equity = 0, maxDD = 0, peakEquity = 0;
  for (const t of chrono) {
    equity += t.netPnl ?? 0;
    if (equity > peak) peak = equity;
    if (peak - equity > maxDD) { maxDD = peak - equity; peakEquity = peak; }
  }
  const maxDDPct = peakEquity > 0 ? maxDD / peakEquity : 0;

  // Current streak — based on chrono
  let streak = 0;
  for (let i = chrono.length - 1; i >= 0; i--) {
    const pl = chrono[i].netPnl ?? 0;
    if (pl > 0) {
      if (streak < 0) break;
      streak++;
    } else if (pl < 0) {
      if (streak > 0) break;
      streak--;
    } else { break; }
  }

  // Best / worst single day
  const byDay: Record<string, number> = {};
  for (const t of ts) byDay[t.date] = (byDay[t.date] ?? 0) + (t.netPnl ?? 0);
  const dayValues = Object.values(byDay);
  const bestDay = dayValues.length ? Math.max(...dayValues) : 0;
  const worstDay = dayValues.length ? Math.min(...dayValues) : 0;

  return {
    netPnl: net, grossPnl: gross, totalFees: fees, tradeCount,
    winCount: wins, lossCount: losses, scratchCount: scratches, winRate,
    avgWin, avgLoss, largestWin, largestLoss,
    profitFactor, expectancy, expectancyR: avgR, totalR, avgR,
    maxDrawdown: maxDD, maxDrawdownPct: maxDDPct, currentStreak: streak,
    bestDay, worstDay,
  };
}

// Equity curve points (cumulative net P&L)
export function equityCurve(trades: Trade[]): { date: string; equity: number; tradeId: number }[] {
  const ts = closedTrades(trades).sort(
    (a, b) => (a.date + a.timeEntry).localeCompare(b.date + b.timeEntry)
  );
  let eq = 0;
  return ts.map(t => {
    eq += t.netPnl ?? 0;
    return { date: t.date, equity: eq, tradeId: t.id };
  });
}

// Daily P&L (summed) — for calendar heatmap and bar chart
export function dailyPnL(trades: Trade[]): Record<string, { pnl: number; trades: number; rTotal: number; }> {
  const out: Record<string, { pnl: number; trades: number; rTotal: number; }> = {};
  for (const t of closedTrades(trades)) {
    const k = t.date;
    if (!out[k]) out[k] = { pnl: 0, trades: 0, rTotal: 0 };
    out[k].pnl += t.netPnl ?? 0;
    out[k].trades += 1;
    out[k].rTotal += t.rMultiple ?? 0;
  }
  return out;
}

// Group + aggregate by an arbitrary key extractor (returns ARRAY of items)
export function groupBy(trades: Trade[], keyFn: (t: Trade) => string | string[]) {
  const out: Record<string, { pnl: number; trades: number; wins: number; losses: number; rTotal: number; }> = {};
  for (const t of closedTrades(trades)) {
    let keys = keyFn(t);
    if (!Array.isArray(keys)) keys = [keys];
    if (keys.length === 0) keys = ["(untagged)"];
    for (const k of keys) {
      if (!out[k]) out[k] = { pnl: 0, trades: 0, wins: 0, losses: 0, rTotal: 0 };
      out[k].pnl += t.netPnl ?? 0;
      out[k].trades += 1;
      out[k].rTotal += t.rMultiple ?? 0;
      if ((t.netPnl ?? 0) > 0) out[k].wins++; else if ((t.netPnl ?? 0) < 0) out[k].losses++;
    }
  }
  return Object.entries(out).map(([key, v]) => ({
    key,
    ...v,
    winRate: v.trades ? v.wins / v.trades : 0,
    avgR: v.trades ? v.rTotal / v.trades : 0,
  }));
}

// Buckets for R-distribution histogram
export function rDistribution(trades: Trade[]): { bucket: string; count: number; }[] {
  const buckets: Record<string, number> = {
    "≤ -3R": 0, "-3R to -2R": 0, "-2R to -1R": 0, "-1R to 0R": 0,
    "0R to 1R": 0, "1R to 2R": 0, "2R to 3R": 0, "≥ 3R": 0,
  };
  for (const t of closedTrades(trades)) {
    const r = t.rMultiple ?? 0;
    if (r <= -3) buckets["≤ -3R"]++;
    else if (r <= -2) buckets["-3R to -2R"]++;
    else if (r <= -1) buckets["-2R to -1R"]++;
    else if (r < 0) buckets["-1R to 0R"]++;
    else if (r < 1) buckets["0R to 1R"]++;
    else if (r < 2) buckets["1R to 2R"]++;
    else if (r < 3) buckets["2R to 3R"]++;
    else buckets["≥ 3R"]++;
  }
  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
}

// Win rate by hour-of-day (entry time)
export function pnlByHour(trades: Trade[]): { hour: string; pnl: number; trades: number; }[] {
  const out: Record<string, { pnl: number; trades: number }> = {};
  for (const t of closedTrades(trades)) {
    const h = (t.timeEntry || "00:00").slice(0, 2);
    if (!out[h]) out[h] = { pnl: 0, trades: 0 };
    out[h].pnl += t.netPnl ?? 0;
    out[h].trades += 1;
  }
  return Object.entries(out)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, v]) => ({ hour: `${hour}:00`, ...v }));
}

// Course-Score (0..100) — blend of profitability, discipline, rule-compliance, risk.
export function courseScore(trades: Trade[], journals: JournalEntry[]): number {
  const ts = closedTrades(trades);
  if (ts.length === 0) return 0;

  // 1) Profitability (0..30): based on expectancy R
  const kpis = computeKPIs(ts);
  const profitScore = Math.max(0, Math.min(30, (kpis.avgR + 0.2) / 0.7 * 30));

  // 2) Rule compliance (0..30): % of trades within window + 4/4 + scaled
  const compliant = ts.filter(t => t.withinWindow && t.fourFourCheck && !t.movedStopTooEarly).length;
  const ruleScore = (compliant / ts.length) * 30;

  // 3) Risk discipline (0..20): how often risk per trade stayed near target
  // We approximate using R-distribution — heavy negative tails hurt
  const blowups = ts.filter(t => (t.rMultiple ?? 0) < -1.5).length;
  const riskScore = Math.max(0, 20 - (blowups / ts.length) * 60);

  // 4) Journaling discipline (0..20): % of trading days journaled
  const tradingDays = new Set(ts.map(t => t.date));
  const journaledDays = new Set(journals.map(j => j.date));
  let overlap = 0;
  tradingDays.forEach(d => { if (journaledDays.has(d)) overlap++; });
  const journalScore = tradingDays.size > 0 ? (overlap / tradingDays.size) * 20 : 0;

  return Math.round(profitScore + ruleScore + riskScore + journalScore);
}

// Helpers exposed for tag-key extractors used in groupBy:
export const tagKeys = {
  setup: (t: Trade) => parseTags(t.setupTags),
  mistake: (t: Trade) => parseTags(t.mistakeTags),
  emotion: (t: Trade) => parseTags(t.emotionTags),
  symbol: (t: Trade) => t.symbol,
  dayOfWeek: (t: Trade) => {
    const d = new Date(t.date + "T12:00:00");
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  },
};
