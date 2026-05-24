// ===== Broker parsers =====
// Each parser is given normalized OCR text. It tries to extract trade rows.
// Detector picks the right parser by scoring keyword matches.
// All parsers return ExtractedTrade[]; missing fields are left undefined and
// surfaced in the preview UI for the user to fill.

import { ExtractedTrade, BrokerKey, ParseResult } from "./types";
import { parseNum, parseDate, normSymbol, estimateConfidence, XTB_CFD_MULTIPLIERS } from "./utils";

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
      /instrument/i, /CFD/i, /Wolumen/i, /Moje Transakcje/i,
      /Zysk\/strata/i, /Instrument/i,
    ],
    strongKeywords: [/Cena otwarcia/i, /Cena zamkni/i, /ID Pozycji/i],
  },
  {
    key: "xtb_mobile",
    label: "XTB mobile",
    keywords: [
      /Moje Transakcje/i, /Zamkni/i, /Operacje gotówkowe/i,
      /Buy/i, /Sell/i,
    ],
    strongKeywords: [/Wolne środki/i, /Zakres dat/i],
  },
  {
    key: "mt5_mobile",
    label: "MetaTrader 5",
    keywords: [
      /Saldo/i, /History/i, /Commissione/i, /Historia/i, /Pozycje/i,
    ],
    strongKeywords: [/Bilancio/i, /Profitto/i, /Posizioni\s+Ordini\s+Affari/i, /Storico/i],
  },
  {
    key: "topstepx",
    label: "TopstepX / Tradovate (Topstep)",
    keywords: [
      /MNQ/i, /NQ/i, /Avg.?\s*Price/i, /Day PnL/i, /Open PnL/i,
    ],
    strongKeywords: [/Total Day PnL/i, /Flatten all/i, /Total Open PnL/i, /Day Total Open/i],
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
// OCR severely corrupts text. Each trade row has a 10-digit position ID (25XXXXXXXX) as anchor.
// Symbol from "NASDAQ 100" context. Date scanned from whole text — OCR mashes dd+mm+yyyy
// into one 8-digit token. Times on next line. Prices have internal spaces (26 764.78).
// PnL: OCR may drop the decimal point ("5591" -> 55.91); fix by dividing integers > 100 by 100.
// Direction & sign: verify via PnL = (exit - entry) * qty * multiplier (NAS100 mult = 20).

function parseXtbDesktop(text: string): ExtractedTrade[] {
  const lines = text.split("\n");
  const out: ExtractedTrade[] = [];

  // Find fallback date by voting on 8-digit ddmmyyyy patterns
  let fallbackDate: string | undefined;
  const fullText = text.replace(/\s+/g, " ");
  const dateVotes = new Map<string, number>();
  const eightDigitMatches = [...fullText.matchAll(/\b(\d{8})\b/g)];
  for (const m of eightDigitMatches) {
    const s = m[1];
    const dd = parseInt(s.slice(0, 2), 10);
    const mm = parseInt(s.slice(2, 4), 10);
    const yy = parseInt(s.slice(4, 8), 10);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 2020 && yy <= 2030) {
      const key = `${dd}-${mm}`;
      dateVotes.set(key, (dateVotes.get(key) || 0) + 1);
    }
  }
  if (dateVotes.size > 0) {
    let bestKey: string | undefined; let bestCount = 0;
    for (const [k, v] of dateVotes) {
      if (v > bestCount) { bestCount = v; bestKey = k; }
    }
    if (bestKey) {
      const [d, mo] = bestKey.split("-").map(Number);
      // Use current year as best guess; OCR years are unreliable
      const year = new Date().getFullYear();
      fallbackDate = `${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  if (!fallbackDate) {
    const dm = text.match(/(\d{1,2})[.,](\d{1,2})[.,](20\d{2})/);
    if (dm) {
      const d = parseInt(dm[1], 10), mo = parseInt(dm[2], 10), yr = parseInt(dm[3], 10);
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
        fallbackDate = `${yr}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const posIdMatch = line.match(/\b(25\d{8})\b/);
    if (!posIdMatch) continue;

    const next = lines[i + 1] ?? "";
    const combined = line + " " + next;

    // Times — HH:MM on next line (entry + exit)
    const timeMatches = [...combined.matchAll(/\b(\d{1,2}:\d{2})\b/g)].map(m => m[1]);

    // Prices: "26 764.78" or "26764.78"
    const priceRegex = /\b(\d{1,3}(?:[\s\u00a0]\d{3})*\.\d{2})\b/g;
    const priceCandidates = [...line.matchAll(priceRegex)]
      .map(m => parseNum(m[1]))
      .filter((n): n is number => n != null && n > 1000 && n < 1_000_000);

    // Quantity: number right after position ID
    const afterId = line.slice(line.indexOf(posIdMatch[1]) + posIdMatch[1].length);
    const volMatch = afterId.match(/^\s+(\d+(?:\.\d+)?)\b/);
    const quantity = volMatch ? parseNum(volMatch[1]) : undefined;

    // PnL: first numeric token AFTER "Transakcje" that isn't a price/quantity
    let pnlText: string | undefined;
    const transIdx = line.search(/Transakcje/i);
    const searchScope = transIdx >= 0 ? line.slice(transIdx + "Transakcje".length) : line;
    const allNumbersInScope = [...searchScope.matchAll(/(-?\d+(?:\.\d+)?)/g)].map(m => m[1]);
    for (const cand of allNumbersInScope) {
      const n = parseNum(cand);
      if (n == null) continue;
      if (priceCandidates.includes(n)) continue;
      if (n === quantity) continue;
      pnlText = cand;
      break;
    }

    let netPnl: number | undefined;
    if (pnlText != null) {
      let n = parseNum(pnlText);
      if (n != null) {
        // OCR dropped decimal point — restore (5591 -> 55.91)
        if (Number.isInteger(n) && Math.abs(n) >= 100) {
          n = n / 100;
        }
        netPnl = n;
      }
    }

    // Symbol
    let symbol: string | undefined;
    const symMatch = combined.match(/\b(US100|NAS100|US\.?500|US30|GER40|DE40|XAU\.?USD|EUR\.?USD|GBP\.?USD|GOLD)\b/i);
    if (symMatch) symbol = normSymbol(symMatch[1]);
    if (!symbol && /nasdaq\s*100/i.test(combined)) symbol = "NAS100";

    // Direction & PnL sign via multiplier verification
    let direction: "long" | "short" | undefined;
    const entryPrice = priceCandidates[0];
    const exitPrice = priceCandidates[priceCandidates.length - 1];
    if (entryPrice != null && exitPrice != null && quantity != null && netPnl != null && symbol) {
      const mult = XTB_CFD_MULTIPLIERS[symbol] ?? 1;
      const longPnl = (exitPrice - entryPrice) * quantity * mult;
      const shortPnl = (entryPrice - exitPrice) * quantity * mult;
      const absPnl = Math.abs(netPnl);
      const longErr = Math.abs(Math.abs(longPnl) - absPnl);
      const shortErr = Math.abs(Math.abs(shortPnl) - absPnl);
      if (longErr <= shortErr) {
        direction = "long";
        netPnl = longPnl > 0 ? absPnl : -absPnl;
      } else {
        direction = "short";
        netPnl = shortPnl > 0 ? absPnl : -absPnl;
      }
    } else {
      if (/\b(buy|kup)\b|uy\b/i.test(combined)) direction = "long";
      else if (/\b(sell|sprzed)\b/i.test(combined)) direction = "short";
    }

    const t: ExtractedTrade = {
      symbol,
      direction,
      date: fallbackDate,
      timeEntry: timeMatches[0],
      timeExit: timeMatches[1],
      entryPrice,
      exitPrice,
      quantity,
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
//   EG US100 CFD                            +294.92 USD
//   100 Buy 0.2 @ 29 130.51
//
// OCR sometimes loses the symbol on subsequent trades — inherit from previous.
// Date from "Zakres dat dd.mm.yyyy - dd.mm.yyyy" footer.

function parseXtbMobile(text: string): ExtractedTrade[] {
  const lines = text.split("\n");
  const out: ExtractedTrade[] = [];

  const rangeMatch = text.match(/Zakres dat[\s\S]*?(\d{1,2})[./](\d{1,2})[./](\d{4})/i);
  let defaultDate: string | undefined;
  if (rangeMatch) {
    defaultDate = `${rangeMatch[3]}-${rangeMatch[2].padStart(2, "0")}-${rangeMatch[1].padStart(2, "0")}`;
  }

  let lastSymbol: string | undefined;

  for (let i = 0; i < lines.length - 1; i++) {
    const l1 = lines[i];
    const l2 = lines[i + 1] ?? "";

    // PnL must be ±NN.NN USD
    const pnlMatch = l1.match(/([+-]?\d+[.,]\d{2})\s*USD\b/i);
    if (!pnlMatch) continue;
    if (/Zysk\/strata|Zakres dat/i.test(l1)) continue;

    // Body: must contain Buy/Sell qty @ price
    const sideMatch = l2.match(/\b(Buy|Sell|Kup|Sprzed)\w*\s+([\d.,]+)\s*@\s*([\d\s\u00a0.,]+?)(?:\s*$|\s+[A-Za-z])/i);
    if (!sideMatch) continue;

    let symbol: string | undefined;
    const symMatch = l1.match(/\b(US100|NAS100|US500|US30|GER40|XAUUSD|EURUSD|GBPUSD|GOLD)\s*(?:CFD)?\b/i);
    if (symMatch) {
      symbol = normSymbol(symMatch[1]);
      lastSymbol = symbol;
    } else {
      symbol = lastSymbol;
    }
    if (!symbol) continue;

    const direction: "long" | "short" = /buy|kup/i.test(sideMatch[1]) ? "long" : "short";
    const quantity = parseNum(sideMatch[2]);
    const entryPrice = parseNum(sideMatch[3]);

    const t: ExtractedTrade = {
      date: defaultDate,
      symbol,
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
//   28231.83 — 28241.48                 2026.05.06 16:30:25

function parseMt5Mobile(text: string): ExtractedTrade[] {
  const lines = text.split("\n");
  const out: ExtractedTrade[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const l1 = lines[i];
    const l2 = lines[i + 1] ?? "";

    const headMatch = l1.match(/\b([A-Z][A-Z0-9.]{1,12})\s+(buy|sell)\s+([\d.,]+)\s+([+-]?\d+[.,]\d+)/i);
    if (!headMatch) continue;

    const symbol = normSymbol(headMatch[1]);
    const direction: "long" | "short" = /buy/i.test(headMatch[2]) ? "long" : "short";
    const quantity = parseNum(headMatch[3]);
    const netPnl = parseNum(headMatch[4]);

    // Prices line — supports em-dash, en-dash, hyphen, arrow
    const pricesMatch = l2.match(/([\d\s.,]+?)\s*[—→\->\u2192\u2014]+\s*([\d\s.,]+?)\s+\d{4}/);
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
// Per-contract rows:
//   114.50 - +$380.00 - 1
// Skip summary rows ("PnL: +$1543.00") that have "PnL:" prefix.

function parseTopstepX(text: string): ExtractedTrade[] {
  const lines = text.split("\n");
  const out: ExtractedTrade[] = [];

  const contractMatch = text.match(/\b(MNQ|NQ|ES|MES|RTY|M2K|CL|MCL|GC|MGC|YM|MYM)([A-Z]\d)?\b/);
  const symbol = contractMatch ? normSymbol(contractMatch[1] + (contractMatch[2] ?? "")) : "MNQ";

  for (const line of lines) {
    if (/PnL\s*:/i.test(line)) continue;
    if (/Total\s*(Day|Open)/i.test(line)) continue;
    if (/Avg\.?\s*Price/i.test(line)) continue;

    const pnlMatch = line.match(/([+-])\$?(\d+(?:[,.]\d{3})*\.\d{2})/);
    if (!pnlMatch) continue;

    const sign = pnlMatch[1] === "-" ? -1 : 1;
    const magnitude = parseNum(pnlMatch[2]);
    if (magnitude == null) continue;
    const netPnl = sign * magnitude;
    if (netPnl === 0) continue;

    const t: ExtractedTrade = {
      symbol,
      direction: netPnl > 0 ? "long" : "short",
      netPnl,
      source: "topstepx",
      confidence: 0.35,
      rawText: line,
      notes: "Imported from TopstepX — entry/exit prices not shown in screenshot",
    };
    out.push(t);
  }
  return out;
}

// ----- Generic fallback -----

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
