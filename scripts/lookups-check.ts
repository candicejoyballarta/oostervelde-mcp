// Spot checks for the lookup tools' logic (get_price, get_work_order,
// get_contract_rule, find_duplicates). Run with: npx tsx scripts/lookups-check.ts
// (console.log is fine here: this script is not the MCP server.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPrice } from "../src/lib/prices.js";
import { loadPriceList } from "../src/lib/priceList.js";
import { getWorkOrder } from "../src/lib/workOrders.js";
import { getContractRule } from "../src/lib/contract.js";
import { findDuplicates } from "../src/lib/duplicates.js";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${!ok && detail ? `  (got ${detail})` : ""}`);
  if (!ok) failures++;
}

// --- get_price ---------------------------------------------------------------
const priceCases: [string, string, number][] = [
  ["H02", "2026-01-06", 6037],
  ["H02", "2025-12-22", 5850],
  ["B02", "2025-12-15", 3800],
  ["J02", "2026-01-16", 121776],
  ["H06", "2026-01-24", 4644],
];
for (const [code, date, expected] of priceCases) {
  const price = getPrice(code, date);
  check(`get_price ${code} ${date} → ${expected}`, price.appliesCents === expected, String(price.appliesCents));
}
console.log(`      e.g. ${getPrice("H02", "2026-01-06").calculation}`);
console.log(`      e.g. ${getPrice("H02", "2025-12-22").calculation}`);

// All 21 indexed prices against docs/phase0-findings.md §3 (read from the doc, not retyped).
const here = path.dirname(fileURLToPath(import.meta.url));
const findings = fs.readFileSync(path.join(here, "..", "docs", "phase0-findings.md"), "utf8");
const section3 = findings.split("## 3.")[1].split("## 4.")[0];
const expected2026 = new Map(
  [...section3.matchAll(/([A-Z]\d{2}) (\d+)\.(\d{2})/g)].map((m) => [m[1], Number(m[2]) * 100 + Number(m[3])]),
);
const mismatches = loadPriceList().filter(
  (item) => getPrice(item.code, "2026-01-01").price2026Cents !== expected2026.get(item.code),
);
check(
  `all ${loadPriceList().length} price2026Cents match phase0 §3 (${expected2026.size} listed)`,
  loadPriceList().length === 21 && expected2026.size === 21 && mismatches.length === 0,
  mismatches.map((m) => m.code).join(", "),
);

// --- get_work_order ----------------------------------------------------------
const wo1012 = getWorkOrder("WO-26-1012");
check(
  "WO-26-1012 extraHoursApproval MU-0233, 2 h",
  wo1012.found && wo1012.extraHoursApproval?.id === "MU-0233" && wo1012.extraHoursApproval.hours === 2,
);
const wo1015 = getWorkOrder("WO-26-1015");
check(
  "WO-26-1015 meerwerkApproval GA-0419, 40000",
  wo1015.found && wo1015.meerwerkApproval?.id === "GA-0419" && wo1015.meerwerkApproval.amountCents === 40000,
);
const wo1035 = getWorkOrder("WO-26-1035");
check("WO-26-1035 built 2025", wo1035.found && wo1035.built === 2025);
check("WO-26-1099 found false", getWorkOrder("WO-26-1099").found === false);

// --- get_contract_rule -------------------------------------------------------
check(
  'get_contract_rule 4.5 dutch contains "ook niet het deel tot EUR 250,00"',
  getContractRule("4.5").dutch.includes("ook niet het deel tot EUR 250,00"),
);

// --- find_duplicates ---------------------------------------------------------
const groups = findDuplicates();
const files = groups[0]?.invoices.map((inv) => inv.file).join(" + ");
check(
  "find_duplicates → one group, WO-26-1013 (j-F26-0001 + j-F26-0019, identical)",
  groups.length === 1 &&
    groups[0].workOrder === "WO-26-1013" &&
    files === "j-F26-0001.txt + j-F26-0019.txt" &&
    groups[0].invoices.every((inv) => inv.identicalLines),
  groups.map((g) => g.workOrder).join(", "),
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
