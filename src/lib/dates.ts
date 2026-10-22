// The parsing helpers return ISO "yyyy-mm-dd", or null when the text doesn't fit.
// isoToDutchLong goes the other way, for Dutch letter text.

const DUTCH_MONTHS: Record<string, number> = {
  januari: 1,
  februari: 2,
  maart: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  augustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  december: 12,
};

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** "06-01-2026" or "05/01/2026" (day first) → "2026-01-06". */
export function dayMonthYearToIso(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!match) return null;
  return toIso(Number(match[3]), Number(match[2]), Number(match[1]));
}

/** "8 januari 2026" → "2026-01-08". */
export function dutchLongDateToIso(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2}) ([a-z]+) (\d{4})$/i);
  if (!match) return null;
  const month = DUTCH_MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  return toIso(Number(match[3]), month, Number(match[1]));
}

/** "2026-01-27" → "27 januari 2026". Throws on anything that isn't ISO. */
export function isoToDutchLong(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const month = match ? Object.keys(DUTCH_MONTHS)[Number(match[2]) - 1] : undefined;
  if (!match || !month) throw new Error(`Not an ISO date: "${iso}"`);
  return `${Number(match[3])} ${month} ${match[1]}`;
}

/** "2026-01-12" → "2026-01-12" (validates it is already ISO). */
export function checkIsoDate(text: string): string | null {
  const match = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return toIso(Number(match[1]), Number(match[2]), Number(match[3]));
}
