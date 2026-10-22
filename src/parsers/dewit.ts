import { parseCents } from "../lib/money.js";
import { dutchLongDateToIso } from "../lib/dates.js";
import {
  MONEY,
  QTY,
  UNIT,
  findCents,
  findMatch,
  findText,
  parseVatLines,
  type ParsedInvoice,
  type ParsedLine,
} from "./common.js";

// "- Arbeid schilder: 12 uur x EUR 50,57 = EUR 606,84 (9% btw)"
// The description is greedy (.+) because meerwerk lines contain a colon of
// their own: "- Meerwerk: houtrot herstellen kozijn trapgat: 1 post x ..."
const ITEM = new RegExp(
  String.raw`^- (.+): (${QTY}) (${UNIT}) x EUR (${MONEY}) = EUR (${MONEY}) \((\d+)% btw\)$`,
);

export function parseDeWit(file: string, lines: string[]): ParsedInvoice {
  const warnings: string[] = [];

  const items: ParsedLine[] = [];
  for (const line of lines.filter((l) => l.startsWith("- "))) {
    const match = line.match(ITEM);
    if (!match) {
      warnings.push(`Could not read item line: "${line}"`);
      continue;
    }
    items.push({
      lineNo: items.length + 1,
      description: match[1].trim(),
      quantity: Number(match[2]),
      unit: match[3],
      unitPriceCents: parseCents(match[4]),
      amountCents: parseCents(match[5]),
      vatRate: Number(match[6]),
    });
  }

  // "Werkzaamheden Beekhuizenseweg 7-B, Velp, uitgevoerd 8 januari 2026"
  const work = findMatch(lines, /^Werkzaamheden (.+), uitgevoerd (.+)$/);
  // "Velp, 12 januari 2026" — the place name, then the invoice date.
  const invoiceDate = findText(lines, /^\w+, (\d{1,2} [a-z]+ \d{4})$/);

  return {
    file,
    invoiceNo: findText(lines, /^FACTUUR\s+(\S+)/),
    supplier: "De Wit",
    isCreditNote: false,
    creditsInvoiceNo: null,
    workOrder: findText(lines, /^Opdracht:\s*(\S+)/),
    address: work ? work[1].trim() : "",
    invoiceDate: dutchLongDateToIso(invoiceDate) ?? "",
    executionDate: work ? (dutchLongDateToIso(work[2]) ?? "") : "",
    lines: items,
    subtotalCents: findCents(lines, new RegExp(`^Totaal excl\\. btw EUR\\s*(${MONEY})$`), "subtotal", warnings),
    vat: parseVatLines(lines),
    totalCents: findCents(lines, new RegExp(`^Totaal incl\\. btw EUR\\s*(${MONEY})$`), "total", warnings),
    warnings,
  };
}
