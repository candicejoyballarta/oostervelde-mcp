// Money is always handled as integer cents. We never turn "2.528,40" into the
// float 2528.4 — we read the euro and cent digits separately instead.

/** Dutch notation: "2.528,40" → 252840, "-46,44" → -4644. */
export function parseCents(text: string): number {
  const match = text.trim().match(/^(-?)(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/);
  if (!match) throw new Error(`Not a Dutch money amount: "${text}"`);

  const [, sign, euros, cents] = match;
  const value = Number(euros.replaceAll(".", "")) * 100 + Number(cents);
  return sign === "-" ? -value : value;
}

/** Dot-decimal notation used in the CSV files: "2450.00" → 245000. */
export function parseDotDecimalCents(text: string): number {
  const match = text.trim().match(/^(-?)(\d+)\.(\d{2})$/);
  if (!match) throw new Error(`Not a dot-decimal money amount: "${text}"`);

  const [, sign, euros, cents] = match;
  const value = Number(euros) * 100 + Number(cents);
  return sign === "-" ? -value : value;
}

/**
 * Contract 4.2: 2025 price × 1.032, rounded half-up to whole cents.
 * Integers only: cents × 1032 / 1000, +500 before flooring rounds half-up.
 * 5850 → 6037 (58.50 × 1.032 = 60.372 → 60.37).
 */
export function indexPrice2026(cents2025: number): number {
  return Math.floor((cents2025 * 1032 + 500) / 1000);
}

/**
 * Integer division rounded half-up (away from zero for negatives).
 * roundDiv(867951, 100) → 8680, i.e. 413,31 × 21% = 86,7951 → 86,80.
 */
export function roundDiv(numerator: number, divisor: number): number {
  const sign = numerator < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(numerator) * 2 + divisor) / (2 * divisor));
}

/** 5850 → "58.50" (plain dot-decimal, for calculation texts). */
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** 252840 → "€ 2.528,40" (for readable warnings). */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+$)/g, ".");
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}€ ${euros},${rest}`;
}
