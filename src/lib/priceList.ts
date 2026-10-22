import { readCsv } from "./csv.js";
import { parseDotDecimalCents } from "./money.js";
import type { Supplier } from "../types.js";

export type PriceListItem = {
  code: string;
  supplier: Supplier;
  description: string;
  unit: string;
  priceCents: number; // 2025 price, excl. VAT
};

let cache: PriceListItem[] | null = null;

export function loadPriceList(): PriceListItem[] {
  if (cache) return cache;

  cache = readCsv("price-agreement-2025.csv").map((row) => ({
    code: row.code,
    supplier: row.supplier as Supplier,
    description: row.description,
    unit: row.unit,
    priceCents: parseDotDecimalCents(row.price_excl_vat_2025),
  }));
  return cache;
}

/** The price-list item for a code like "H02" (case-insensitive), or null. */
export function findPriceItem(code: string): PriceListItem | null {
  const wanted = code.trim().toUpperCase();
  return loadPriceList().find((item) => item.code === wanted) ?? null;
}

/**
 * Finds the price-list code for an invoice line: first an exact
 * (case-insensitive) description match, then a price-list description the
 * invoice line starts with. Returns null when nothing matches — we never guess.
 */
export function findCode(supplier: Supplier, description: string): string | null {
  const wanted = description.trim().toLowerCase();
  const items = loadPriceList().filter((item) => item.supplier === supplier);

  const exact = items.find((item) => item.description.toLowerCase() === wanted);
  if (exact) return exact.code;

  const prefix = items.find((item) => wanted.startsWith(item.description.toLowerCase()));
  return prefix ? prefix.code : null;
}
