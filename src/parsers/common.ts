import fs from "node:fs";
import path from "node:path";
import { INVOICES_DIR } from "../lib/paths.js";
import { parseCents } from "../lib/money.js";
import type { Invoice, InvoiceLine, VatEntry } from "../types.js";

// What a supplier parser returns. The shared step in index.ts adds `code` and
// `isMeerwerk` to each line, and runs the self-checks.
export type ParsedLine = Omit<InvoiceLine, "code" | "isMeerwerk">;
export type ParsedInvoice = Omit<Invoice, "lines"> & { lines: ParsedLine[] };

// Building blocks for the line regexes.
export const MONEY = String.raw`-?[\d.]*\d,\d{2}`; // "2.528,40", "-46,44"
export const QTY = String.raw`-?\d+`; // whole numbers only, can be negative
// Longest units first, so "m2" is tried before "m".
export const UNIT = "rol 25 m|liter|stuk|keer|post|uur|dag|m2|m";

/** Reads an invoice file as lines, without "\r" or trailing spaces. */
export function readLines(file: string): string[] {
  const text = fs.readFileSync(path.join(INVOICES_DIR, file), "utf8");
  return text.split(/\r?\n/).map((line) => line.trimEnd());
}

/** The first line matching `regex`, as a match result (or null). */
export function findMatch(lines: string[], regex: RegExp): RegExpMatchArray | null {
  for (const line of lines) {
    const match = line.match(regex);
    if (match) return match;
  }
  return null;
}

/** Group 1 of the first matching line, or "" if no line matches. */
export function findText(lines: string[], regex: RegExp): string {
  return findMatch(lines, regex)?.[1].trim() ?? "";
}

/** Group 1 of the first matching line as cents; 0 plus a warning if missing. */
export function findCents(
  lines: string[],
  regex: RegExp,
  label: string,
  warnings: string[],
): number {
  const text = findText(lines, regex);
  if (text === "") {
    warnings.push(`Could not find the ${label}.`);
    return 0;
  }
  return parseCents(text);
}

/** All "BTW 21% over 211,56: 44,43" lines (same wording for every supplier). */
export function parseVatLines(lines: string[]): VatEntry[] {
  const regex = new RegExp(String.raw`^\s*BTW (\d+)% over (${MONEY}): (${MONEY})$`);
  const entries: VatEntry[] = [];
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      entries.push({
        rate: Number(match[1]),
        baseCents: parseCents(match[2]),
        amountCents: parseCents(match[3]),
      });
    }
  }
  return entries;
}
