// ===== OCR Import — types =====
// One ExtractedTrade per row found in a broker screenshot.
// confidence: 0..1 estimated by parser based on how many fields matched
// missingFields: list of fields user must fill in before save (e.g. stop price)

export type BrokerKey =
  | "xtb_desktop"
  | "xtb_mobile"
  | "mt5_mobile"
  | "topstepx"
  | "tradovate"
  | "ninjatrader"
  | "ibkr"
  | "generic";

export interface ExtractedTrade {
  // Mapped to schema fields (1:1 with InsertTrade where possible)
  date?: string;          // yyyy-mm-dd
  timeEntry?: string;     // HH:MM
  timeExit?: string;      // HH:MM
  symbol?: string;        // normalized: US100→NAS100 etc handled later
  direction?: "long" | "short";
  entryPrice?: number;
  exitPrice?: number;
  stopPrice?: number;
  quantity?: number;
  netPnl?: number;        // dollars
  notes?: string;

  // Meta — used in preview only
  confidence: number;     // 0..1
  source: BrokerKey;
  rawText?: string;       // original OCR snippet for debugging
}

export interface ParseResult {
  broker: BrokerKey;
  brokerLabel: string;
  trades: ExtractedTrade[];
  rawText: string;
}
