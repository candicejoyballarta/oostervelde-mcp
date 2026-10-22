// Runs check_invoice's logic on all 40 invoices and compares against the
// answer key (docs/phase0-findings.md). Run with: npx tsx scripts/checks-check.ts
// (console.log is fine here: this script is not the MCP server.)
import { listInvoiceFiles } from "../src/parsers/index.js";
import { checkInvoice } from "../src/checks/index.js";
import { formatCents } from "../src/lib/money.js";
import type { CheckResult } from "../src/checks/types.js";

// Expected dispute totals incl. VAT, in cents. Every other invoice: 0.
const EXPECTED_DISPUTES: Record<string, number> = {
  "h-2026-0038.txt": 2917,
  "h-2026-0040.txt": 9486,
  "h-2026-0044.txt": 14610,
  "h-2026-0052.txt": 10000,
  "h-2026-0057.txt": 2623,
  "h-2026-0058.txt": 5620,
  "w-DW26-002.txt": 5880,
  "w-DW26-011.txt": 6068,
  "w-DW26-016.txt": 1090,
  "w-DW26-018.txt": 11024,
  "j-F26-0016.txt": 3296,
  "j-F26-0019.txt": 169884,
  "j-F26-0021.txt": 5619,
  "j-F26-0024.txt": 37510,
  "b-B-26-0089.txt": 4429,
  "b-B-26-0102.txt": 5619,
  "b-B-26-0127.txt": 7742,
  "b-B-26-0131.txt": 29040,
  "b-B-26-0140.txt": 7079,
  "b-B-26-0144.txt": 1711,
};
const EXPECTED_GRAND_TOTAL = 341247;

// Invoices that must have a hold finding; no other invoice may have one.
// null = any hold; a number = the VAT shortfall (expected − billed) on the hold.
const EXPECTED_HOLDS: Record<string, number | null> = {
  "w-DW26-013.txt": null, // unknown work order WO-26-1099
  "h-2026-0061.txt": 5028, // VAT too low
  "w-DW26-015.txt": 9028, // VAT too low
};

const results = listInvoiceFiles().map((file) => checkInvoice(file));

// --- Table + findings ------------------------------------------------------------
const kinds = (r: CheckResult, kind: string) => r.findings.filter((f) => f.kind === kind).length;
console.log("file            | billed       | corrected    | dispute     | d/h/i | ok");
for (const r of results) {
  console.log(
    [
      r.file.padEnd(15),
      formatCents(r.billedTotalCents).padStart(12),
      formatCents(r.correctedTotalCents).padStart(12),
      formatCents(r.disputeTotalCents).padStart(11),
      `${kinds(r, "dispute")}/${kinds(r, "hold")}/${kinds(r, "info")}`.padEnd(5),
      r.reconciles ? "✓" : "NOT RECONCILED",
    ].join(" | "),
  );
}
console.log("\nFindings (dispute and hold):");
for (const r of results) {
  for (const f of r.findings.filter((f) => f.kind !== "info")) {
    const line = f.lineNo === null ? "invoice" : `line ${f.lineNo}`;
    const amount = f.kind === "dispute" ? ` ${formatCents(f.disputeInclVatCents)}` : "";
    console.log(`  ${r.file} ${f.kind.toUpperCase()} ${f.rule} ${line}${amount}: ${f.summary}`);
  }
}

// --- Checks ------------------------------------------------------------------------
let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${!ok && detail ? `  (got ${detail})` : ""}`);
  if (!ok) failures++;
}
console.log("");

check("40 invoices checked", results.length === 40, String(results.length));

for (const r of results) {
  const expected = EXPECTED_DISPUTES[r.file] ?? 0;
  if (r.disputeTotalCents !== expected) {
    check(`${r.file} dispute ${formatCents(expected)}`, false, formatCents(r.disputeTotalCents));
  }
}
const wrong = results.filter((r) => r.disputeTotalCents !== (EXPECTED_DISPUTES[r.file] ?? 0)).length;
check(`all 40 dispute totals match (${Object.keys(EXPECTED_DISPUTES).length} non-zero)`, wrong === 0, `${wrong} wrong`);

const grandTotal = results.reduce((sum, r) => sum + r.disputeTotalCents, 0);
check(`grand total ${formatCents(EXPECTED_GRAND_TOTAL)}`, grandTotal === EXPECTED_GRAND_TOTAL, formatCents(grandTotal));

for (const [file, shortfall] of Object.entries(EXPECTED_HOLDS)) {
  const holds = results.find((r) => r.file === file)?.findings.filter((f) => f.kind === "hold") ?? [];
  const ok =
    holds.length > 0 && (shortfall === null || holds.some((h) => h.expectedCents - h.billedCents === shortfall));
  check(`${file} hold${shortfall !== null ? ` (VAT short ${formatCents(shortfall)})` : ""}`, ok, `${holds.length} holds`);
}
const unexpectedHolds = results.filter((r) => !(r.file in EXPECTED_HOLDS) && kinds(r, "hold") > 0);
check("no hold findings on any other invoice", unexpectedHolds.length === 0, unexpectedHolds.map((r) => r.file).join(", "));

const r0049 = results.find((r) => r.file === "h-2026-0049.txt")!;
const rC003 = results.find((r) => r.file === "h-2026-C003.txt")!;
check(
  "2026-0049 dispute 0, info finding referencing 2026-C003",
  r0049.disputeTotalCents === 0 && r0049.findings.some((f) => f.kind === "info" && f.summary.includes("2026-C003")),
);
check(
  "2026-C003 dispute 0, info finding referencing 2026-0049",
  rC003.disputeTotalCents === 0 && rC003.findings.some((f) => f.kind === "info" && f.summary.includes("2026-0049")),
);

const unreconciled = results.filter((r) => !r.reconciles);
check("every invoice reconciles", unreconciled.length === 0, unreconciled.map((r) => r.file).join(", "));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
