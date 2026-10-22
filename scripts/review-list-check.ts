// Checks output/review-list.md and .csv against tool output: every euro amount
// Claude wrote must appear in what check_invoice / get_run_totals return.
// Run with: npx tsx scripts/review-list-check.ts
// (console.log is fine here: this script is not the MCP server.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listInvoiceFiles } from "../src/parsers/index.js";
import { checkInvoice } from "../src/checks/index.js";
import { getRunTotals } from "../src/checks/runTotals.js";
import { withEuros } from "../src/lib/money.js";

const OUTPUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "output");

// "€ 1.698,84", "-€ 46,44" (nl) and "€1,698.84" (en).
const EURO = /-?€ ?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}/g;

// Everything the tools return, as text: Eur strings plus amounts inside summaries and evidence.
const toolOutput = [withEuros(getRunTotals()), ...listInvoiceFiles().map((f) => withEuros(checkInvoice(f)))];
const toolText = JSON.stringify(toolOutput);
const allowed = new Set(toolText.match(EURO) ?? []);
const allowedCsv = new Set<string>();
JSON.stringify(toolOutput, (key, value) => {
  if (key.endsWith("Eur") && value?.csv) allowedCsv.add(value.csv);
  return value;
});

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${!ok && detail ? `  (got ${detail})` : ""}`);
  if (!ok) failures++;
}

const md = fs.readFileSync(path.join(OUTPUT_DIR, "review-list.md"), "utf8");
const mdAmounts = md.match(EURO) ?? [];
const unknown = [...new Set(mdAmounts.filter((a) => !allowed.has(a)))];
check(`all ${mdAmounts.length} euro amounts in review-list.md come from tool output`, unknown.length === 0, unknown.join(", "));
check("review-list.md shows grand total € 3.412,47", md.includes("€ 3.412,47"));
check("review-list.md shows 20 dispute · 3 hold · 17 approve", md.includes("20 dispute · 3 hold · 17 approve"));

// CSV: split on commas outside quotes; columns 10–13 are euro values.
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted && ch === '"' && line[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  return [...cells, cell];
}
const HEADER =
  "invoice_file,invoice_no,supplier,work_order,proposed_verdict,label,rule,line_no,summary,billed_eur,expected_eur,dispute_excl_vat_eur,dispute_incl_vat_eur";
const rows = fs.readFileSync(path.join(OUTPUT_DIR, "review-list.csv"), "utf8").trim().split(/\r?\n/).map(splitCsvLine);
check("review-list.csv has the expected header", rows[0]?.join(",") === HEADER, rows[0]?.join(","));
const wrongWidth = rows.filter((r) => r.length !== 13).length;
check("every CSV row has 13 columns", wrongWidth === 0, `${wrongWidth} rows`);
const badCells = rows
  .slice(1)
  .flatMap((r) => r.slice(9, 13))
  .filter((cell) => cell !== "" && !allowedCsv.has(cell));
check(`all CSV euro values come from tool output (${rows.length - 1} rows)`, badCells.length === 0, [...new Set(badCells)].join(", "));

// Every invoice is in the CSV, with get_run_totals' proposed verdict.
const proposed = new Map(getRunTotals().invoices.map((i) => [i.file, i.proposedVerdict]));
const csvFiles = new Set(rows.slice(1).map((r) => r[0]));
const missing = [...proposed.keys()].filter((f) => !csvFiles.has(f));
check("every invoice appears in the CSV", missing.length === 0, missing.join(", "));
const wrongVerdict = rows.slice(1).filter((r) => proposed.get(r[0]) !== r[4]).map((r) => r[0]);
check("every CSV row has the proposed verdict from get_run_totals", wrongVerdict.length === 0, [...new Set(wrongVerdict)].join(", "));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
