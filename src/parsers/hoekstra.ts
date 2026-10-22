import { parseCents } from "../lib/money.js";
import { dayMonthYearToIso } from "../lib/dates.js";
import {
  MONEY,
  QTY,
  UNIT,
  findCents,
  findText,
  parseVatLines,
  type ParsedInvoice,
  type ParsedLine,
} from "./common.js";

// A table row, read from the right: amount, unit price, unit, quantity, and
// everything left over is the description. Units come from a fixed list
// because both descriptions ("15 mm") and units ("rol 25 m") contain spaces.
const ROW = new RegExp(
  String.raw`^(.*?)\s+(${QTY})\s+(${UNIT})\s+(${MONEY})\s+(${MONEY})$`,
);

export function parseHoekstra(file: string, lines: string[]): ParsedInvoice {
  const warnings: string[] = [];

  // The item table sits between the first and second "-----" line.
  const dashed = lines.flatMap((line, i) => (line.startsWith("-----") ? [i] : []));
  const tableRows = dashed.length >= 2 ? lines.slice(dashed[0] + 1, dashed[1]) : [];
  if (dashed.length < 2) warnings.push("Could not find the item table.");

  const items: ParsedLine[] = [];
  for (const row of tableRows) {
    if (row.trim() === "") continue;
    const match = row.match(ROW);
    if (!match) {
      warnings.push(`Could not read table row: "${row.trim()}"`);
      continue;
    }
    items.push({
      lineNo: items.length + 1,
      description: match[1].trim(),
      quantity: Number(match[2]),
      unit: match[3],
      unitPriceCents: parseCents(match[4]),
      amountCents: parseCents(match[5]),
      vatRate: null,
    });
  }

  const creditsInvoiceNo = findText(lines, /^Betreft creditering van factuur\s+(\S+)/);

  return {
    file,
    invoiceNo: findText(lines, /^Factuurnummer:\s*(\S+)/),
    supplier: "Hoekstra",
    isCreditNote: lines.some((line) => line.trim() === "CREDITFACTUUR"),
    creditsInvoiceNo: creditsInvoiceNo || null,
    workOrder: findText(lines, /^Uw werkorder:\s*(\S+)/),
    address: findText(lines, /^Adres uitvoering:\s*(.+)$/),
    invoiceDate: dayMonthYearToIso(findText(lines, /^Factuurdatum:\s*(\S+)/)) ?? "",
    executionDate: dayMonthYearToIso(findText(lines, /^Datum uitvoering:\s*(\S+)/)) ?? "",
    lines: items,
    subtotalCents: findCents(lines, new RegExp(`^Subtotaal excl\\. BTW:\\s*(${MONEY})$`), "subtotal", warnings),
    vat: parseVatLines(lines),
    totalCents: findCents(lines, new RegExp(`^TOTAAL TE BETALEN: EUR\\s*(${MONEY})$`), "total", warnings),
    warnings,
  };
}
