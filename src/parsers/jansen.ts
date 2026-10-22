import { parseCents } from "../lib/money.js";
import { dayMonthYearToIso } from "../lib/dates.js";
import {
  MONEY,
  QTY,
  UNIT,
  findCents,
  findMatch,
  parseVatLines,
  type ParsedInvoice,
  type ParsedLine,
} from "./common.js";

// Each item is two lines: the description, then an indented amount line:
//   Arbeid elektricien
//       2 uur @ 57,79 -> 115,58
const AMOUNT_LINE = new RegExp(
  String.raw`^\s+(${QTY}) (${UNIT}) @ (${MONEY}) -> (${MONEY})$`,
);

export function parseJansen(file: string, lines: string[]): ParsedInvoice {
  const warnings: string[] = [];

  const items: ParsedLine[] = [];
  lines.forEach((line, i) => {
    if (!line.includes(" @ ")) return;
    const match = line.match(AMOUNT_LINE);
    const description = i > 0 ? lines[i - 1].trim() : "";
    if (!match || description === "") {
      warnings.push(`Could not read item: "${description}" / "${line.trim()}"`);
      return;
    }
    items.push({
      lineNo: items.length + 1,
      description,
      quantity: Number(match[1]),
      unit: match[2],
      unitPriceCents: parseCents(match[3]),
      amountCents: parseCents(match[4]),
      vatRate: null,
    });
  });

  // "FACTUUR F26-0007 (07/01/2026)"
  const header = findMatch(lines, /^FACTUUR (\S+) \((\S+)\)/);
  // "Werkbon: WO-26-1003, Hoofdstraat 118, Rheden, uitgevoerd op 05/01/2026"
  const workOrder = findMatch(lines, /^Werkbon: (WO-[\d-]+), (.+), uitgevoerd op (\S+)$/);

  return {
    file,
    invoiceNo: header ? header[1] : "",
    supplier: "Jansen",
    isCreditNote: false,
    creditsInvoiceNo: null,
    workOrder: workOrder ? workOrder[1] : "",
    address: workOrder ? workOrder[2].trim() : "",
    invoiceDate: header ? (dayMonthYearToIso(header[2]) ?? "") : "",
    executionDate: workOrder ? (dayMonthYearToIso(workOrder[3]) ?? "") : "",
    lines: items,
    subtotalCents: findCents(lines, new RegExp(`^Subtotaal:\\s*(${MONEY})$`), "subtotal", warnings),
    vat: parseVatLines(lines),
    totalCents: findCents(lines, new RegExp(`^Totaal: EUR\\s*(${MONEY})$`), "total", warnings),
    warnings,
  };
}
