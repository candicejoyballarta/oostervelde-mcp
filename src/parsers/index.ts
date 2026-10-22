import fs from "node:fs";
import { INVOICES_DIR } from "../lib/paths.js";
import { findCode } from "../lib/priceList.js";
import type { Invoice, InvoiceLine } from "../types.js";
import { readLines, type ParsedInvoice } from "./common.js";
import { parseHoekstra } from "./hoekstra.js";
import { parseDeWit } from "./dewit.js";
import { parseBosman } from "./bosman.js";
import { parseJansen } from "./jansen.js";
import { selfChecks } from "./selfChecks.js";

// The first letter of the file name says which supplier layout to expect.
const PARSERS: Record<string, (file: string, lines: string[]) => ParsedInvoice> = {
  h: parseHoekstra,
  w: parseDeWit,
  b: parseBosman,
  j: parseJansen,
};

export function listInvoiceFiles(): string[] {
  return fs.readdirSync(INVOICES_DIR).filter((f) => f.endsWith(".txt"));
}

/** Parses one invoice file (e.g. "h-2026-0031.txt") into the common shape. */
export function parseInvoice(file: string): Invoice {
  const parse = PARSERS[file[0]];
  if (!parse) throw new Error(`No parser for "${file}" (expected a h-, w-, b- or j- prefix).`);

  const parsed = parse(file, readLines(file));

  // Lines without their own VAT rate get the invoice's rate, but only when
  // there is exactly one VAT line (otherwise we can't tell which applies).
  const invoiceRate = parsed.vat.length === 1 ? parsed.vat[0].rate : null;

  const lines: InvoiceLine[] = parsed.lines.map((line) => ({
    lineNo: line.lineNo,
    description: line.description,
    code: findCode(parsed.supplier, line.description),
    isMeerwerk: /^meerwerk:/i.test(line.description),
    quantity: line.quantity,
    unit: line.unit,
    unitPriceCents: line.unitPriceCents,
    amountCents: line.amountCents,
    vatRate: line.vatRate ?? invoiceRate,
  }));

  const invoice: Invoice = { ...parsed, lines };
  invoice.warnings = [...parsed.warnings, ...selfChecks(invoice)];
  return invoice;
}
