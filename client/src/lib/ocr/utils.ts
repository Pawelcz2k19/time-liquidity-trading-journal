// ===== Parser utility helpers =====

/** Normalize OCR text: collapse whitespace, fix common OCR confusions. */
export function normalize(text: string): string {
  return text
    .replace(/\u00a0/g, " ")     // nbsp
    .replace(/[│|]/g, " ")        // table dividers OCR'd
    .replace(/\r/g, "")
    .split("\n")
    .map(l => l.trim().replace(/\s{2,}/g, " "))
    .filter(Boolean)
    .join("\n");
}

/** Parse a number that may use space or apostrophe thousand separators and dot/comma decimals. */
export function parseNum(s: string | undefined | null): number | undefined {
  if (s == null) return undefined;
  let t = s.trim()
    .replace(/[\s\u00a0']/g, "")      // remove thousand seps
    .replace(/[+]/g, "");
  // If both . and , present, the last one is decimal
  const lastDot = t.lastIndexOf(".");
  const lastComma = t.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      t = t.replace(/\./g, "").replace(",", ".");
    } else {
      t = t.replace(/,/g, "");
    }
  } else if (lastComma >= 0 && lastDot < 0) {
    // European: comma is decimal
    t = t.replace(",", ".");
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse a date in many formats. Returns yyyy-mm-dd or undefined. */
export function parseDate(s: string): string | undefined {
  if (!s) return undefined;
  s = s.trim();

  // yyyy-mm-dd already
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

  // dd.mm.yyyy or dd/mm/yyyy
  m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  // yyyy.mm.dd
  m = s.match(/(\d{4})[./](\d{1,2})[./](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

  return undefined;
}

/** Parse HH:MM or HH:MM:SS. */
export function parseTime(s: string): string | undefined {
  const m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return undefined;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** Normalize a broker symbol to a sensible canonical form. */
export function normSymbol(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
  // Common mappings
  const map: Record<string, string> = {
    "US100": "NAS100",
    "US100CASH": "NAS100",
    "USTEC": "NAS100",
    "NAS100CFD": "NAS100",
    "MNQM6": "MNQ",
    "MNQH6": "MNQ",
    "MNQU6": "MNQ",
    "MNQZ6": "MNQ",
    "NQM6": "NQ",
    "NQH6": "NQ",
    "NQU6": "NQ",
    "NQZ6": "NQ",
  };
  return map[s] ?? s;
}

/** Estimate confidence based on field completeness. */
export function estimateConfidence(t: Record<string, any>, importantFields: string[]): number {
  const present = importantFields.filter(f => t[f] != null && t[f] !== "").length;
  return Math.min(1, present / importantFields.length);
}
