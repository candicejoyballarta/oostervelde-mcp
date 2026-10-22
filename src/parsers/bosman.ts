import { parseCents } from "../lib/money.js";
import { checkIsoDate } from "../lib/dates.js";
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

// " 1. Dakgoot zink    |   14 m     | a     55,73 |     780,22"
// Columns are separated by "|"; "a" means "at" (per unit).
const ROW = new RegExp(
  String.raw`^\s*(\d+)\.\s+(.+?)\s*\|\s*(${QTY})\s+(${UNIT})\s*\|\s*a\s+(${MONEY})\s*\|\s*(${MONEY})$`,
);

export function parseBosman(file: string, lines: string[]): ParsedInvoice {
  const warnings: string[] = [];

  const items: ParsedLine[] = [];
  for (const line of lines.filter((l) => l.includes("|"))) {
    const match = line.match(ROW);
    if (!match) {
      warnings.push(`Could not read item row: "${line.trim()}"`);
      continue;
    }
    items.push({
      lineNo: Number(match[1]), // Bosman numbers its own rows
      description: match[2].trim(),
      quantity: Number(match[3]),
      unit: match[4],
      unitPriceCents: parseCents(match[5]),
      amountCents: parseCents(match[6]),
      vatRate: null,
    });
  }

  // "FACTUUR  nr. B-26-0102   datum 2026-01-15"
  const header = findMatch(lines, /^FACTUUR\s+nr\.\s+(\S+)\s+datum\s+(\S+)/);

  return {
    file,
    invoiceNo: header ? header[1] : "",
    supplier: "Bosman",
    isCreditNote: false,
    creditsInvoiceNo: null,
    workOrder: findText(lines, /\(werkorder (WO-[\d-]+)\)/),
    address: findText(lines, /^Locatie:\s*(.+)$/),
    invoiceDate: header ? (checkIsoDate(header[2]) ?? "") : "",
    executionDate: checkIsoDate(findText(lines, /^Uitvoeringsdatum:\s*(\S+)/)) ?? "",
    lines: items,
    subtotalCents: findCents(lines, new RegExp(`^\\s*netto\\s+(${MONEY})$`), "subtotal (netto)", warnings),
    vat: parseVatLines(lines),
    totalCents: findCents(lines, new RegExp(`^\\s*totaal\\s+(${MONEY})$`), "total (totaal)", warnings),
    warnings,
  };
}
