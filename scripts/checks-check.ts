// Runs check_invoice's logic on all 40 invoices and compares against the
// answer key (docs/phase0-findings.md). Run with: npx tsx scripts/checks-check.ts
// (console.log is fine here: this script is not the MCP server.)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listInvoiceFiles } from "../src/parsers/index.js";
import { checkInvoice } from "../src/checks/index.js";
import { getRunTotals } from "../src/checks/runTotals.js";
import { getDecisions, recordDecision } from "../src/lib/decisions.js";
import { formatCents, withEuros } from "../src/lib/money.js";
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

// The review list shows this as the net of the pair: billed − credited.
check(
  "2026-0049 corrected total = billed − credited = € 168,58",
  r0049.correctedTotalCents === 16858 && r0049.billedTotalCents - r0049.creditedCents === 16858,
  formatCents(r0049.correctedTotalCents),
);

const r0019 = results.find((r) => r.file === "j-F26-0019.txt")!;
const dup = r0019.findings.find((f) => f.rule === "4.8");
check(
  'Dutch dates: F26-0019 "27 januari 2026", original F26-0001 "2 januari 2026"',
  r0019.invoiceDateNl === "27 januari 2026" && dup?.originalInvoiceNo === "F26-0001" && dup.originalInvoiceDateNl === "2 januari 2026",
  `${r0019.invoiceDateNl} / ${dup?.originalInvoiceNo} ${dup?.originalInvoiceDateNl}`,
);

const r0038 = results.find((r) => r.file === "h-2026-0038.txt")!;
check('Dutch execution date: 2026-0038 "17 december 2025"', r0038.executionDateNl === "17 december 2025", r0038.executionDateNl);

// --- get_run_totals ------------------------------------------------------------------
const totals = getRunTotals();
check(`run totals grand total ${formatCents(EXPECTED_GRAND_TOTAL)}`, totals.grandDisputeTotalCents === EXPECTED_GRAND_TOTAL, formatCents(totals.grandDisputeTotalCents));
const { dispute, hold, approve } = totals.verdictCounts;
check("proposed verdicts 20 dispute / 3 hold / 17 approve", dispute === 20 && hold === 3 && approve === 17, `${dispute}/${hold}/${approve}`);
const heldFiles = totals.invoices.filter((i) => i.proposedVerdict === "hold").map((i) => i.file).sort();
check("held invoices are exactly the expected holds", heldFiles.join() === Object.keys(EXPECTED_HOLDS).sort().join(), heldFiles.join(", "));
const supplierSum = totals.perSupplier.reduce((sum, s) => sum + s.disputeTotalCents, 0);
check("supplier totals add up to the grand total", supplierSum === totals.grandDisputeTotalCents, formatCents(supplierSum));
const euros = withEuros(totals).grandDisputeTotalEur;
check(
  'euro strings "€ 3.412,47" / "€3,412.47" / "3412.47"',
  euros.nl === "€ 3.412,47" && euros.en === "€3,412.47" && euros.csv === "3412.47",
  JSON.stringify(euros),
);

// --- record_decision / get_decisions (temp file, never the real state/) ------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oostervelde-"));
const log = path.join(tmpDir, "decisions.json");
check("no log file → no decisions", getDecisions(log).length === 0);
recordDecision({ file: "h-2026-0058.txt", verdict: "dispute", reason: "first" }, log);
recordDecision({ file: "w-DW26-013.txt", verdict: "hold", reason: "waiting for housing officer" }, log);
recordDecision({ file: "h-2026-0058.txt", verdict: "approve", reason: "second trip was real", decidedBy: "Test" }, log);
const stored = JSON.parse(fs.readFileSync(log, "utf8"));
check("log is append-only (3 entries, first kept)", stored.length === 3 && stored[0].reason === "first", String(stored.length));
const latest = getDecisions(log).find((d) => d.file === "h-2026-0058.txt");
check(
  "latest decision wins, 1 earlier counted",
  latest?.verdict === "approve" && latest.decidedBy === "Test" && latest.earlierDecisions === 1,
  JSON.stringify(latest),
);
check("decidedBy defaults to Sanne", stored[0].decidedBy === "Sanne", stored[0].decidedBy);
let unknownRejected = false;
try {
  recordDecision({ file: "../package.json", verdict: "approve", reason: "x" }, log);
} catch {
  unknownRejected = true;
}
check("unknown invoice file is rejected", unknownRejected && JSON.parse(fs.readFileSync(log, "utf8")).length === 3);
const corrupt = path.join(tmpDir, "corrupt.json");
fs.writeFileSync(corrupt, '{"not": "an array"}');
let corruptRejected = false;
try {
  recordDecision({ file: "h-2026-0058.txt", verdict: "approve", reason: "x" }, corrupt);
} catch {
  corruptRejected = true;
}
check("a non-array log is refused and left unchanged", corruptRejected && fs.readFileSync(corrupt, "utf8") === '{"not": "an array"}');
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
