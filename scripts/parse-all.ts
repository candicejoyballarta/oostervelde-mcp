// Parses every invoice and prints one row per file, then runs spot checks.
// Run with: npx tsx scripts/parse-all.ts
// (console.log is fine here: this script is not the MCP server.)
import { listInvoiceFiles, parseInvoice } from "../src/parsers/index.js";
import type { Invoice } from "../src/types.js";

const invoices = new Map<string, Invoice>();
for (const file of listInvoiceFiles()) invoices.set(file, parseInvoice(file));

// --- Table -----------------------------------------------------------------
const header = ["file", "invoiceNo", "workOrder", "executionDate", "#lines", "#codes null", "warnings"];
const rows = [...invoices.values()].map((inv) => [
  inv.file,
  inv.invoiceNo,
  inv.workOrder,
  inv.executionDate,
  String(inv.lines.length),
  String(inv.lines.filter((line) => line.code === null).length),
  String(inv.warnings.length),
]);
const widths = header.map((h, col) => Math.max(h.length, ...rows.map((row) => row[col].length)));
const format = (row: string[]) => row.map((cell, col) => cell.padEnd(widths[col])).join(" | ");

console.log(format(header));
console.log(widths.map((w) => "-".repeat(w)).join("-|-"));
for (const row of rows) console.log(format(row));

// --- Warnings ----------------------------------------------------------------
// These invoices really are wrong (checked by hand), so the self-checks must
// flag them with exactly this text. Any other warning means a parser bug; a
// missing one means a self-check stopped working.
const EXPECTED_INVOICE_ERRORS: Record<string, string[]> = {
  // subtotal 339,01 + VAT 71,19 = 410,20, but the total says 510,20
  "h-2026-0052.txt": ["Subtotal + VAT = € 410,20, but the total is € 510,20."],
  // "Plafond sausen" 30 m2 × 7,43 = 222,90, but the line says 232,90
  "w-DW26-016.txt": ["Line 2: 30 × € 7,43 = € 222,90, but the line says € 232,90."],
};

let expectedFound = 0;
let unexpectedWarnings = 0;
let missingExpected = 0;

for (const inv of invoices.values()) {
  const expected = EXPECTED_INVOICE_ERRORS[inv.file] ?? [];
  for (const warning of inv.warnings) {
    if (expected.includes(warning)) {
      console.log(`  EXPECTED INVOICE ERROR ${inv.file}: ${warning}`);
      expectedFound++;
    } else {
      console.log(`  PARSER WARNING ${inv.file}: ${warning}`);
      unexpectedWarnings++;
    }
  }
}

for (const [file, expected] of Object.entries(EXPECTED_INVOICE_ERRORS)) {
  const warnings = invoices.get(file)?.warnings ?? [];
  for (const warning of expected.filter((w) => !warnings.includes(w))) {
    console.log(`  MISSING EXPECTED ERROR ${file}: ${warning}`);
    missingExpected++;
  }
}

console.log(
  `\n${invoices.size} files: ${expectedFound} expected invoice errors, ` +
    `${unexpectedWarnings} unexpected warnings, ${missingExpected} missing expected errors\n`,
);

// --- Spot checks -----------------------------------------------------------
let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) failures++;
}
const get = (file: string) => {
  const inv = invoices.get(file);
  if (!inv) throw new Error(`Missing file ${file}`);
  return inv;
};

check("40 files parsed", invoices.size === 40);
check("no unexpected warnings (parser bugs)", unexpectedWarnings === 0);
check("all expected invoice errors still detected", missingExpected === 0);

check("h-2026-0038 executionDate 2025-12-17", get("h-2026-0038.txt").executionDate === "2025-12-17");

check("w-DW26-013 workOrder WO-26-1099", get("w-DW26-013.txt").workOrder === "WO-26-1099");

const credit = get("h-2026-C003.txt");
check(
  "h-2026-C003 credit note for 2026-0049, total -5619",
  credit.isCreditNote && credit.creditsInvoiceNo === "2026-0049" && credit.totalCents === -5619,
);

for (const file of ["j-F26-0001.txt", "j-F26-0019.txt"]) {
  const inv = get(file);
  check(`${file} WO-26-1013, total 169884`, inv.workOrder === "WO-26-1013" && inv.totalCents === 169884);
}

const h58 = get("h-2026-0058.txt");
check(
  "h-2026-0058 has 4 lines, two with code H06",
  h58.lines.length === 4 && h58.lines.filter((line) => line.code === "H06").length === 2,
);

const nullLines = get("b-B-26-0140.txt").lines.filter((line) => line.code === null);
check(
  "b-B-26-0140 one null code (Vogelwering dakgoot)",
  nullLines.length === 1 && nullLines[0].description === "Vogelwering dakgoot",
);

const vat14 = get("w-DW26-014.txt").vat;
check(
  "w-DW26-014 VAT 9% base 139776 and 21% base 30330",
  vat14.length === 2 &&
    vat14.some((v) => v.rate === 9 && v.baseCents === 139776) &&
    vat14.some((v) => v.rate === 21 && v.baseCents === 30330),
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
