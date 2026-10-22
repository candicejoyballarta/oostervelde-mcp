import { checkIsoDate } from "./dates.js";
import { centsToDecimal, indexPrice2026 } from "./money.js";
import { findPriceItem } from "./priceList.js";
import type { Supplier } from "../types.js";

export type PriceLookup = {
  code: string;
  supplier: Supplier;
  description: string;
  unit: string;
  price2025Cents: number;
  price2026Cents: number;
  appliesCents: number; // the price that applies on executionDate
  priceYear: 2025 | 2026;
  calculation: string;
};

// Contract 4.2: work done up to and including this date uses 2025 prices.
const LAST_2025_DAY = "2025-12-31";

/** The unrounded indexed price, e.g. 5850 → "60.372" (from the integer cents × 1032). */
function exactIndexed(cents2025: number): string {
  const hundredThousandths = cents2025 * 1032; // 5850 × 1032 = 6037200 → 60.37200 euro
  const euros = Math.floor(hundredThousandths / 100000);
  const fraction = String(hundredThousandths % 100000)
    .padStart(5, "0")
    .replace(/0+$/, "")
    .padEnd(2, "0");
  return `${euros}.${fraction}`;
}

/** Contract price for a code on the date the work was done. Throws on bad input. */
export function getPrice(code: string, executionDate: string): PriceLookup {
  const item = findPriceItem(code);
  if (!item) throw new Error(`Unknown price-list code "${code}". Codes look like "H02" (H01-H07, W01-W04, B01-B05, J01-J05).`);

  const date = checkIsoDate(executionDate);
  if (!date) throw new Error(`Invalid executionDate "${executionDate}". Use ISO yyyy-mm-dd, e.g. "2026-01-06".`);

  const price2025 = item.priceCents;
  const price2026 = indexPrice2026(price2025);
  const priceYear = date <= LAST_2025_DAY ? 2025 : 2026;
  const indexing = `${centsToDecimal(price2025)} × 1.032 = ${exactIndexed(price2025)} → ${centsToDecimal(price2026)}`;

  const calculation =
    priceYear === 2026
      ? `${indexing} (work done ${date}, 2026 price applies)`
      : `2025 price ${centsToDecimal(price2025)} applies (work done ${date}, on or before ${LAST_2025_DAY}); indexed would be ${indexing}`;

  return {
    code: item.code,
    supplier: item.supplier,
    description: item.description,
    unit: item.unit,
    price2025Cents: price2025,
    price2026Cents: price2026,
    appliesCents: priceYear === 2026 ? price2026 : price2025,
    priceYear,
    calculation,
  };
}
