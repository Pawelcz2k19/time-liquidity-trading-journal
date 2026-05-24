// ===== Broker parsers =====
// Each parser is given normalized OCR text. It tries to extract trade rows.
// Detector picks the right parser by scoring keyword matches.
// All parsers return ExtractedTrade[]; missing fields are left undefined and
// surfaced in the preview UI for the user to fill.

import { ExtractedTrade, BrokerKey, ParseResult } from "./types";
import { parseNum, parseDate, parseTime, normSymbol, estimateConfidence } from "./utils";

// ----- Detector -----

interface BrokerProfile {
  key: BrokerKey;
  label: string;
  keywords: RegExp[];   // any match scores +1
  strongKeywords?: RegExp[]; // match scores +2
}

const PROFILES: BrokerProfile[] = [
  {
    key: "xtb_desktop",
    label: "XTB (desktop / web)",
    keywords: [
      /instrument/i, /CFD/i, /Wolumen/i, /Cena otwarcia/i, /Cena zamkni/i,
      /Moje Transakcje/i, /Zysk\/strata/i, /ID Pozycji/i,
    ],
    strongKeywords: [/Cena otwarcia/i, /Cena zamkni/i, /ID Pozycji/i],
  },
  {
    key: "xtb_mobile",
    label: "XTB mobile",
    keywords: [
      /Moje Transakcje/i, /Wolne środki/i, /Zamkni/i, /Operacje gotówkowe/i,
      /Zakres dat/i, /Buy/i, /Sell/i,
    ],
    strongKeywords: [/Wolne środki/i, /Zakres dat/i],
  },
  {
    key: "mt5_mobile",
    label: "MetaTrader 5",
    keywords: [
      /Storico/i, /Posizioni/i, /Affari/i, /Bilancio/i, /Profitto/i, /Commissione/i,
      /Historia/i, /Pozycje/i, /Transakcje/i, /Saldo/i, /History/i, /Trade/i,
      /buy \d/i, /sell \d/i,
    ],
    strongKeywords: [/Bilancio/i, /Profitto/i, /Commissione/i],
  },
  {
    key: "topstepx",
    label: "TopstepX / Tradovate (Topstep)",
    keywords: [
      /Total Day PnL/i, /Total Open PnL/i, /Day PnL/i, /Open PnL/i,
      /MNQM\d/i, /NQM\d/i, /ESM\d/i, /Flatten all/i, /Cancel all orders/i,
      /Avg.?\s*Price/i,
    ],
    strongKeywords: [/Total Day PnL/i, /Flatten all/i],
  },
  {
    key: "tradovate",
    label: "Tradovate",
    keywords: [/Tradovate/i, /P&?L/i, /Realized P/i, /Unrealized P/i],
  },
  {
    key: "ninjatrader",
    label: "NinjaTrader",
    keywords: [/NinjaTrader/i, /Account Performance/i, /Cum\.?\s*Profit/i],
  },
  {
    key: "ibkr",
    label: "Interactive Brokers",
    keywords: [/Interactive Brokers/i, /IBKR/i, /TWS/i],
  },
];

export function detectBroker(text: string): { key: BrokerKey; label: string; score: number } {
  let best: { key: BrokerKey; label: string; score: number } = {
    key: "generic",
    label: "Generic (best-effort)",
    score: 0,
  };
  for (const p of PROFILES) {
    let score = 0;
    for (const r of p.keywords) if (r.test(text)) score += 1;
    for (const r of p.strongKeywords ?? []) if (r.test(text)) score += 2;
    if (score > best.score) {
      best = { key: p.key, label: p.label, score };
    }
  }
  return best;
}

// ----- XTB desktop (table) -----
//
// Row layout example (one line after OCR collapse):
//   US100 CFD Buy 2525362075 0.1 21.04.2026 15:36 26 764.78 21.04.2026 15:58 26 813.94 Moje Transakcje 98.32
//
// Strategy: find lines containing 2 dates close together and parse positionally.

function parseXtbDesktop(text: string): ExtractedTrade[] {
  const lines = text.split("\n");
  const out: ExtractedTrade[] = [];

  for (const line of lines) {
    // Need at least 2 dates and a number that looks like P&L at the end
    const dateMatches = [...line.matchAll(/(\d{1,2})[./](\d{1,2})[./](\d{4})\s*(\d{1,2}:\d{2})?/g)];
    if (dateMatches.length < 1) continue;

    const lower = line.toLowerCase();
    const isBuy = /\bbuy\b/.test(lower);
    const isSell = /\bsell\b/.test(lower);
    if (!isBuy && !isSell) continue;

    // Get all numbers in the line (with thousand-separated decimals)
    const numbers = [...line.matchAll(/-?\d[\d\s\u00a0',.]*\d|-?\d+/g)]
      .map(m => m[0])
      .map(parseNum)
      .filter((n): n is number => n != null);

    // Find the symbol — usually first uppercase word
    const symMatch = line.match(/\b([A-Z]{2,}[A-Z0-9.]*)\b/);
    const symbol = symMatch ? normSymbol(symMatch[1]) : undefined;

    // P&L = last small-ish number (heuristic: typically < entry price, has 2 decimals)
    // Better: P&L is the last signed number in the line
    const lastNumMatch = line.match(/(-?\d+[.,]\d{2})\s*$/);
    const netPnl = lastNumMatch ? parseNum(lastNumMatch[1]) : undefined;

    // Try to find entry/exit prices: the two largest values
    const sorted = [...numbers].filter(n => n > 100 && n < 1_000_000).sort((a, b) => b - a);
    const priceCandidates = sorted.slice(0, 4);

    // Times
    const times = [...line.matchAll(/(\d{1,2}:\d{2})/g)].map(m => m[1]);
    const dates = dateMatches.map(m => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);

    // Volume / qty — small number near the start, often < 100
    const qty = numbers.find(n => n > 0 && n < 100 && n !== netPnl && !Number.isInteger(n))
              ?? numbers.find(n => n > 0 && n < 1000 && n !== netPnl);

    const t: ExtractedTrade = {
      symbol,
      direction: isBuy ? "long" : "short",
      date: dates[0],
      timeEntry: times[0],
      timeExit: times[1],
      entryPrice: priceCandidates[1] ?? priceCandidates[0],
      exitPrice: priceCandidates[0],
      quantity: qty,
      netPnl,
      source: "xtb_desktop",
      confidence: 0,
      rawText: line,
    };
    t.confidence = estimateConfidence(t, ["date", "symbol", "direction", "entryPrice", "exitPrice", "netPnl", "quantity"]);
    if (t.confidence >= 0.4) out.push(t);
  }
  return out;
}

// ----- XTB mobile -----
//
// Layout (each trade spans 2 lines):
//   US100 CFD                              +294.92 USD
//   Buy 0.2 @ 29 130.51
//
// The screen has "Dzisiaj" or a date header. We use the date footer ("Zakres dat")
// if available. timeExit / entry/exit prices are not on this screen — leave blank.

function parseXtbMobile(text: string): ExtractedTrade[] {
  const lines = text.split("\n");
  const out: ExtractedTrade[] = [];

  // Pull a default date from "Zakres dat 20.05.2026 - 20.05.2026"
  const rangeMatch = text.match(/Zakres dat\s*(\d{1,2}[./]\d{1,2}[./]\d{4})/i);
  const defaultDate = rangeMatch ? parseDate(rangeMatch[1]) : undefined;

  for (let i = 0; i < lines.length - 1; i++) {
    const l1 = lines[i];
    const l2 = lines[i + 1] ?? "";

    const symMatch = l1.match(/\b([A-Z]{2,6}\d{0,3}(?:\.[A-Z]+)?)\s*(CFD|cash)?/);
    if (!symMatch) continue;

    const pnlMatch = l1.match(/([+-]?\d+[\s.,]?\d*[.,]\d{2})\s*USD/i)
                   ?? l1.match(/([+-]?\d+[.,]\d{2})\s*$/);
    if (!pnlMatch) continue;

    const sideMatch = l2.match(/\b(Buy|Sell)\b\s*([0-9.,]+)?\s*@?\s*([\d\s\u00a0.,]+)?/i);
    if (!sideMatch) continue;

    const direction = /buy/i.test(sideMatch[1]) ? "long" : "short";
    const quantity = parseNum(sideMatch[2]);
    const entryPrice = parseNum(sideMatch[3]);

    const t: ExtractedTrade = {
      date: defaultDate,
      symbol: normSymbol(symMatch[1]),
      direction,
      quantity,
      entryPrice,
      netPnl: parseNum(pnlMatch[1]),
      source: "xtb_mobile",
      confidence: 0,
      rawText: `${l1} | ${l2}`,
    };
    t.confidence = estimateConfidence(t, ["date", "symbol", "direction", "quantity", "entryPrice", "netPnl"]);
    if (t.confidence >= 0.4) out.push(t);
  }
  return out;
}

// ----- MT5 mobile (Storico / History) -----
//
// Layout:
//   US100.cash sell 2                    -16.43
//   28231.83 -> 28241.48                 2026.05.06 16:30:25

function parseMt5Mobile(text: string): ExtractedTrade[] {
  const lines = text.split("\n");
  const out: ExtractedTrade[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const l1 = lines[i];
    const l2 = lines[i + 1] ?? "";

    const headMatch = l1.match(/\b([A-Z]{2,8}(?:\.[a-zA-Z]+)?)\s+(buy|sell)\s+([\d.,]+)\s+([+-]?\d+[.,]\d+)/i);
    if (!headMatch) continue;

    const symbol = normSymbol(headMatch[1]);
    const direction = /buy/i.test(headMatch[2]) ? "long" : "short";
    const quantity = parseNum(headMatch[3]);
    const netPnl = parseNum(headMatch[4]);

    // Second line: "28231.83 -> 28241.48 2026.05.06 16:30:25"
    const pricesMatch = l2.match(/([\d\s.,]+)\s*[-—–>]+\s*([\d\s.,]+)/);
    const entryPrice = pricesMatch ? parseNum(pricesMatch[1]) : undefined;
    const exitPrice = pricesMatch ? parseNum(pricesMatch[2]) : undefined;

    const dateMatch = l2.match(/(\d{4})[./](\d{1,2})[./](\d{1,2})\s+(\d{1,2}:\d{2})/);
    const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}` : undefined;
    const timeEntry = dateMatch?.[4];

    const t: ExtractedTrade = {
      date,
      timeEntry,
      symbol,
      direction,
      quantity,
      entryPrice,
      exitPrice,
      netPnl,
      source: "mt5_mobile",
      confidence: 0,
      rawText: `${l1} | ${l2}`,
    };
    t.confidence = estimateConfidence(t, ["date", "symbol", "direction", "quantity", "entryPrice", "exitPrice", "netPnl"]);
    if (t.confidence >= 0.4) out.push(t);
  }
  return out;
}

// ----- TopstepX / Tradovate (Topstep) -----
//
// Has total Day PnL at top + per-contract rows. The screenshot may be cropped
// (no entry/exit prices visible), so we surface what's there with low confidence.
//
// Row layout example:
//   414.50     -      +$380.00      -      -
//   (balance avg.Price DayPnL OpenPnL Qty)

function parseTopstepX(text: string): ExtractedTrade[] {
  const lines = text.split("\n");
  const out: ExtractedTrade[] = [];

  // Try to find the contract name (MNQM6, NQM6, etc.)
  const contractMatch = text.match(/\b(MNQ|NQ|ES|MES|RTY|M2K|CL|MCL|GC|MGC|YM|MYM)([A-Z]\d)?\b/);
  const symbol = contractMatch ? normSymbol(contractMatch[1] + (contractMatch[2] ?? "")) : "MNQ";

  for (const line of lines) {
    // Match rows like "414.50  -  +$380.00  -  -"
    // or "+$380.00" alone
    const dayPnlMatch = line.match(/([+-]?\$[\d,]+\.\d{2})/);
    if (!dayPnlMatch) continue;
    if (/Total\s*Day\s*PnL/i.test(line)) continue; // skip the total row

    const netPnl = parseNum(dayPnlMatch[1].replace("$", ""));
    if (netPnl == null || netPnl === 0) continue;

    const t: ExtractedTrade = {
      symbol,
      direction: netPnl > 0 ? "long" : "short", // best-effort, user can flip
      netPnl,
      source: "topstepx",
      confidence: 0,
      rawText: line,
      notes: "Imported from TopstepX — entry/exit prices not shown in screenshot",
    };
    t.confidence = 0.35; // low — fields missing
    out.push(t);
  }
  return out;
}

// ----- Generic fallback -----
//
// Tries to extract any line that looks like a trade — number + symbol-ish + PnL.

function parseGeneric(text: string): ExtractedTrade[] {
  const lines = text.split("\n");
  const out: ExtractedTrade[] = [];

  for (const line of lines) {
    const symMatch = line.match(/\b([A-Z]{2,8})\b/);
    const dirMatch = line.match(/\b(buy|sell|long|short)\b/i);
    const pnlMatch = line.match(/[+-]?\$?\d+[.,]\d{2}/);
    if (!symMatch || !pnlMatch) continue;

    const direction = dirMatch ? (/buy|long/i.test(dirMatch[1]) ? "long" : "short") : undefined;

    const t: ExtractedTrade = {
      symbol: normSymbol(symMatch[1]),
      direction,
      netPnl: parseNum(pnlMatch[0].replace("$", "")),
      source: "generic",
      confidence: 0.25,
      rawText: line,
    };
    out.push(t);
  }
  return out;
}

// ----- Main entry point -----

export function parseText(rawText: string): ParseResult {
  const detected = detectBroker(rawText);

  let trades: ExtractedTrade[] = [];
  switch (detected.key) {
    case "xtb_desktop": trades = parseXtbDesktop(rawText); break;
    case "xtb_mobile":  trades = parseXtbMobile(rawText); break;
    case "mt5_mobile":  trades = parseMt5Mobile(rawText); break;
    case "topstepx":    trades = parseTopstepX(rawText); break;
    default:            trades = parseGeneric(rawText);
  }

  // If broker-specific parser found nothing but text exists, try generic
  if (trades.length === 0 && detected.key !== "generic") {
    trades = parseGeneric(rawText);
  }

  return {
    broker: detected.key,
    brokerLabel: detected.score > 0 ? PROFILES.find(p => p.key === detected.key)?.label ?? "Generic" : "Generic (best-effort)",
    trades,
    rawText,
  };
}
