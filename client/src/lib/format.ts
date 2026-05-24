// Formatting helpers used across the app.
export function formatCurrency(value: number | null | undefined, currency = "USD", short = false): string {
  if (value == null || isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (short && abs >= 1000) {
    const sign = value < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatNumber(v: number | null | undefined, digits = 2): string {
  if (v == null || isNaN(v)) return "—";
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPercent(v: number | null | undefined, digits = 1): string {
  if (v == null || isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatR(r: number | null | undefined): string {
  if (r == null || isNaN(r)) return "—";
  const sign = r > 0 ? "+" : "";
  return `${sign}${r.toFixed(2)}R`;
}

export function pnlClass(v: number | null | undefined): string {
  if (v == null || v === 0) return "pnl-neutral";
  return v > 0 ? "pnl-positive" : "pnl-negative";
}

export function parseTags(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function stringifyTags(tags: string[]): string {
  return JSON.stringify(tags ?? []);
}

// Course-strategy tag presets — surfaced as quick-pick chips in the form
export const SETUP_TAGS = [
  "VWAP reclaim",
  "Opening drive",
  "Opening drive fade",
  "Range break + retest",
  "Range fade",
  "Prior day high break",
  "Prior day low break",
  "ONH sweep",
  "ONL sweep",
  "POC reclaim",
  "Naked POC",
  "Initial Balance break",
  "Liquidity grab",
  "Failed breakout",
  "Trend pullback",
];

export const MISTAKE_TAGS = [
  "FOMO entry",
  "Outside 9:30-10:15 window",
  "No 4/4 confirmation",
  "Moved stop too early",
  "Held past 10:15",
  "Oversized position",
  "Revenge trade",
  "Counter-trend chase",
  "Ignored news event",
  "No written plan",
  "Skipped scaling sequence",
  "Took 4th idea after 3-idea max",
];

export const EMOTION_TAGS = [
  "Calm",
  "Focused",
  "Confident",
  "Anxious",
  "Frustrated",
  "Greedy",
  "Fearful",
  "Tired",
  "Tilted",
  "Rushed",
];

export const SYMBOL_PRESETS = [
  { symbol: "NQ", pointValue: 20, name: "NASDAQ-100 Futures" },
  { symbol: "MNQ", pointValue: 2, name: "Micro NASDAQ-100" },
  { symbol: "ES", pointValue: 50, name: "S&P 500 Futures" },
  { symbol: "MES", pointValue: 5, name: "Micro S&P 500" },
  { symbol: "QQQ", pointValue: 1, name: "Invesco QQQ ETF" },
  { symbol: "SPY", pointValue: 1, name: "SPDR S&P 500 ETF" },
  { symbol: "NAS100", pointValue: 1, name: "NAS100 CFD" },
  { symbol: "US100", pointValue: 1, name: "US100 CFD" },
];
