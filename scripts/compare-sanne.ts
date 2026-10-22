// Compares Sanne's verdicts on the first 10 invoices (data/reference/sanne-verdicts.csv)
// with the proposed verdicts and writes output/sanne-comparison.md.
// Run with: npx tsx scripts/compare-sanne.ts
// Every verdict and amount comes from the check code; only the explanatory prose is written here.
// (console.log is fine here: this script is not the MCP server.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCsv } from "../src/lib/csv.js";
import { DATA_DIR } from "../src/lib/paths.js";
import { parseInvoice } from "../src/parsers/index.js";
import { checkInvoice } from "../src/checks/index.js";
import { proposedVerdict } from "../src/checks/runTotals.js";
import { FREE_LIMIT_CENTS } from "../src/checks/meerwerk.js";
import { getContractRule } from "../src/lib/contract.js";
import { getWorkOrder } from "../src/lib/workOrders.js";
import { getPrice } from "../src/lib/prices.js";
import { formatCents, parseCents, roundDiv } from "../src/lib/money.js";
import type { CheckResult, Finding } from "../src/checks/types.js";
import type { Invoice } from "../src/types.js";

const OUTPUT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "output", "sanne-comparison.md");

// Sanne's notes, translated.
const TRANSLATIONS: Record<string, string> = {
  "spoed, voorrijkosten ok": "emergency job, call-out fee OK",
  "prijzen kloppen met de nieuwe prijslijst": "prices match the new price list",
  "voorrijkosten op regulier werk, 45,00 + btw terugvragen": "call-out fee on regular work, reclaim 45.00 + VAT",
  "meerwerk 385,00 boven de 250, geen akkoord gezien": "extra work 385.00 is above the 250, no approval seen",
  "8 uur gefactureerd, max 6. 2 uur terugvragen": "8 hours billed, max 6; reclaim 2 hours",
  "schilderarbeid tegen 21% btw, moet 9%": "painter labour at 21% VAT, should be 9%",
  spoed: "emergency job",
};

// This month's invoice with meerwerk above the limit and no GA approval (4.5).
const UNAPPROVED_MEERWERK_FILE = "j-F26-0024.txt";

function fail(message: string): never {
  console.error(`compare-sanne: ${message}`);
  process.exit(1);
}

/** Returns `text` if the audit transcript still contains it; fails otherwise. */
function transcriptQuote(text: string): string {
  const transcript = fs.readFileSync(path.join(DATA_DIR, "task-audit-transcript.md"), "utf8");
  if (!transcript.includes(text)) fail(`"${text}" is no longer in task-audit-transcript.md`);
  return text;
}

/** "2025-12-17" → "17 December 2025" (English text). */
function enDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Rewrites every ISO date in copied tool text as an English long date. */
const englishDates = (text: string) => text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, enDate);

// Contract 4.2: prices indexed once by "3,2 procent" (money.ts indexPrice2026 does the maths).
const INDEXATION = "3.2%";

// The rule Sanne applied, as a short phrase for "Where Sanne was right".
const RULE_PHRASES: Record<string, string> = {
  "4.3": "no call-out fee on a regular work order",
  "4.4": "hours above the work order's maximum are only paid with an MU approval",
  "4.6": "painter labour on a home older than two years gets 9% VAT",
};

const plusVat = (excl: number, rate: number) => excl + roundDiv(excl * rate, 100);

// --- Sanne's amount, read from her note --------------------------------------------------

type SanneAmount =
  | { kind: "stated" | "implied"; cents: number; how: string }
  | { kind: "none" };

/**
 * approve → € 0,00. "45,00 + btw" → that amount plus VAT at the disputed line's rate.
 * "2 uur terugvragen" → 2 × the contract price of the disputed labour line, plus VAT.
 */
function sanneAmount(verdict: string, note: string, invoice: Invoice, ours: CheckResult): SanneAmount {
  if (verdict === "approve") return { kind: "stated", cents: 0, how: "approved" };
  const line = invoice.lines.find((l) => l.lineNo === ours.findings.find((f) => f.kind === "dispute")?.lineNo);
  const rate = line?.vatRate ?? 21;

  const plusBtw = note.match(/(\d{1,3}(?:\.\d{3})*,\d{2}) \+ btw/);
  if (plusBtw) {
    const excl = parseCents(plusBtw[1]);
    return { kind: "stated", cents: plusVat(excl, rate), how: `${formatCents(excl)} + ${rate}% VAT = ${formatCents(plusVat(excl, rate))}` };
  }

  const hours = note.match(/(\d+) uur terugvragen/);
  if (hours && line?.code) {
    const n = Number(hours[1]);
    const price = getPrice(line.code, invoice.executionDate).appliesCents;
    const excl = n * price;
    return {
      kind: "implied",
      cents: plusVat(excl, rate),
      how: `${n} h × ${formatCents(price)} (${line.code}, contract price) = ${formatCents(excl)} + ${rate}% VAT = ${formatCents(plusVat(excl, rate))}`,
    };
  }
  return { kind: "none" };
}

// --- Rows ----------------------------------------------------------------------------------

type Row = {
  file: string;
  invoiceNo: string;
  supplier: string;
  sanneVerdict: string;
  note: string;
  english: string;
  invoice: Invoice;
  ours: CheckResult;
  ourVerdict: string;
  sanne: SanneAmount;
  match: string;
  agreesOnVerdict: boolean;
  agreesOnAmount: boolean;
};

const rows: Row[] = readCsv(path.join("reference", "sanne-verdicts.csv")).map((csv) => {
  const note = csv.sanne_note;
  const english = note ? TRANSLATIONS[note] : "";
  if (note && !english) fail(`no translation for Sanne's note "${note}"`);

  const invoice = parseInvoice(csv.invoice_file);
  const ours = checkInvoice(csv.invoice_file);
  const ourVerdict = proposedVerdict(ours);
  const sanne = sanneAmount(csv.verdict, note, invoice, ours);

  const agreesOnVerdict = csv.verdict === ourVerdict;
  const sameAmount = sanne.kind !== "none" && sanne.cents === ours.disputeTotalCents;
  const match = !agreesOnVerdict
    ? "no"
    : sanne.kind === "none"
      ? "verdict only (no amount given)"
      : !sameAmount
        ? "verdict only (amount differs)"
        : sanne.kind === "implied"
          ? "yes (amount implied by her note)"
          : "yes";

  return {
    file: csv.invoice_file,
    invoiceNo: csv.invoice_no,
    supplier: csv.supplier,
    sanneVerdict: csv.verdict,
    note,
    english,
    invoice,
    ours,
    ourVerdict,
    sanne,
    match,
    agreesOnVerdict,
    agreesOnAmount: agreesOnVerdict && sameAmount,
  };
});

// --- Contract quotes -------------------------------------------------------------------------

function quote(article: string): string {
  const rule = getContractRule(article);
  return `> **Article ${rule.article} ${rule.title}**\n>\n> "${rule.dutch}"\n>\n> *${rule.english}*`;
}

/** The one sentence of an article that contains `marker` (fails if the contract text changed). */
function sentence(text: string, marker: string): string {
  const found = text.split(/(?<=\.) /).find((s) => s.includes(marker));
  if (!found) fail(`contract sentence with "${marker}" not found`);
  return found;
}

// --- Differences: one written explanation per invoice, numbers from code ------------------------

const disputes = (r: Row): Finding[] => r.ours.findings.filter((f) => f.kind === "dispute");

/** The note for check_invoice's one-cent rounding adjustment, from the finding's own evidence line. */
function roundingNote(findings: Finding[]): string[] {
  const amount = findings.flatMap((f) => f.evidence).map((e) => e.match(/^Rounding: (\S+ [\d.,]+) added/)?.[1]).find(Boolean);
  if (!amount) return [];
  return [
    "",
    `Line amounts include a ${amount.replace(/^-/, "−")} rounding adjustment so they add up to the invoice difference ` +
      "(VAT is rounded over the whole invoice, as on the invoice itself).",
  ];
}

const EXPLANATIONS: Record<string, { articles: string[]; why: (r: Row) => string }> = {
  "h-2026-0038.txt": {
    articles: ["4.2"],
    why: (r) =>
      [
        `The invoice is dated ${enDate(r.invoice.invoiceDate)}, so Sanne checked the prices against the new (2026) price list, and they match it. ` +
          `But 4.2 makes the **execution date** decisive, not the invoice date: the work was done on ${enDate(r.invoice.executionDate)}, ` +
          `so the 2025 prices apply.`,
        "",
        ...disputes(r).map(
          (f) => `- Line ${f.lineNo} (${f.lineDescription}): billed ${formatCents(f.billedCents)}, at 2025 prices ${formatCents(f.expectedCents)} → ${formatCents(f.disputeInclVatCents)} incl. VAT`,
        ),
        ...roundingNote(disputes(r)),
        "",
        `Together: **${formatCents(r.ours.disputeTotalCents)} incl. VAT** to dispute.`,
      ].join("\n"),
  },
  "w-DW26-009.txt": {
    articles: ["4.5"],
    why: (r) => {
      const wo = getWorkOrder(r.ours.workOrder);
      const approval = wo.found ? wo.meerwerkApproval : null;
      const meerwerk = r.ours.findings.find((f) => f.rule === "4.5");
      if (!approval || !meerwerk) fail(`DW26-009: expected a GA approval and a 4.5 finding`);

      const said = transcriptQuote("I think if they don't have it, we only pay the 250?");
      const rule = getContractRule("4.5");

      // An invoice in this month's run where her belief would cost money: meerwerk without GA, disputed in full.
      const unapproved = checkInvoice(UNAPPROVED_MEERWERK_FILE).findings.find(
        (f) => f.rule === "4.5" && f.kind === "dispute" && f.expectedCents === 0,
      );
      if (!unapproved) fail(`${UNAPPROVED_MEERWERK_FILE} no longer has an unapproved-meerwerk dispute`);

      return [
        `Sanne saw meerwerk of ${formatCents(meerwerk.billedCents)}, above the ${formatCents(FREE_LIMIT_CENTS)} that needs no approval, ` +
          `and found no approval. The work-order export does have one: ${wo.wo} has **${approval.id} for ${formatCents(approval.amountCents)}**, ` +
          `which covers the ${formatCents(meerwerk.billedCents)} billed. Under 4.5 it is paid in full, so we propose to approve.`,
        "",
        `**A second misunderstanding, moot here.** In the audit call (3 Feb 2026, translated from Dutch) Sanne said: ` +
          `*"${said}"* Article 4.5 says the opposite: without approval, nothing is paid: ` +
          `"${sentence(rule.dutch, "ook niet het deel tot")}" (*${sentence(rule.english, "not even the part")}*). ` +
          `It makes no difference on DW26-009 because ${approval.id} covers the amount, but on an invoice without approval ` +
          `she would pay ${formatCents(FREE_LIMIT_CENTS)} that isn't owed. This month's ${parseInvoice(UNAPPROVED_MEERWERK_FILE).invoiceNo} ` +
          `is that case: meerwerk of ${formatCents(unapproved.billedCents)} without a GA approval, none of it payable.`,
      ].join("\n");
    },
  },
  "b-B-26-0102.txt": {
    articles: ["4.3", "4.2"],
    why: (r) => {
      const f = disputes(r)[0];
      const line = r.invoice.lines.find((l) => l.lineNo === f.lineNo);
      if (!line?.code || r.sanne.kind === "none") fail("B-26-0102: expected a call-out line and an amount from Sanne");
      const price = getPrice(line.code, r.invoice.executionDate);
      return [
        `Right rule, wrong amount. The work order is regular, so under 4.3 no call-out fee is paid; Sanne caught that. ` +
          `She reclaimed ${r.sanne.how}, using ${formatCents(price.price2025Cents)}, the **2025** price of ${line.code}. ` +
          `The indexed price applies (4.2): ${formatCents(price.price2025Cents)} + ${INDEXATION} = ${formatCents(price.price2026Cents)} ` +
          `(work done ${enDate(r.invoice.executionDate)}, so the 2026 price applies). ` +
          `The fee billed and disputed is ${formatCents(f.billedCents)}, which is ${formatCents(f.disputeInclVatCents)} incl. VAT.`,
        "",
        `Difference: Sanne ${formatCents(r.sanne.cents)}, proposed **${formatCents(r.ours.disputeTotalCents)}**.`,
      ].join("\n");
    },
  },
  "w-DW26-011.txt": {
    articles: ["4.6"],
    why: (r) => {
      const f = disputes(r)[0];
      return [
        `Same verdict, same rule: painter labour on a home older than two years gets 9% VAT. Sanne didn't state an amount; ` +
          `the check adds it: **${formatCents(f.disputeInclVatCents)}** of VAT charged too much.`,
        "",
        ...f.evidence.map((e) => `- ${englishDates(e)}`),
      ].join("\n");
    },
  },
};

const differences = rows.filter((r) => !r.agreesOnAmount);
for (const r of differences) if (!EXPLANATIONS[r.file]) fail(`${r.invoiceNo} differs (${r.match}) but has no written explanation`);
for (const file of Object.keys(EXPLANATIONS)) {
  if (!differences.some((r) => r.file === file)) fail(`${file} has an explanation but no longer differs; update the script`);
}

// --- Report ----------------------------------------------------------------------------------

const amountCell = (r: Row) => formatCents(r.ours.disputeTotalCents);
const agreeVerdict = rows.filter((r) => r.agreesOnVerdict).length;
const agreeAmount = rows.filter((r) => r.agreesOnAmount).length;
const summary = `${agreeVerdict} of ${rows.length} agree on the verdict; ${agreeAmount} of those also on the amount.`;

const md: string[] = [
  "# Comparison with Sanne's verdicts: first 10 invoices",
  "",
  "Sanne's verdicts and notes from January (`data/reference/sanne-verdicts.csv`) next to the proposed verdicts from " +
    "`check_invoice`. Generated by `scripts/compare-sanne.ts`; every verdict and amount comes from the check code.",
  "",
  `**${summary}**`,
  "",
  "| Invoice | Sanne | Her note (Dutch) | English | Proposed | Our dispute (incl. VAT) | Match |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map(
    (r) =>
      `| ${r.invoiceNo} (${r.supplier}) | ${r.sanneVerdict} | ${r.note ? `"${r.note}"` : "–"} | ${r.english || "–"} | ` +
      `${r.ourVerdict} | ${amountCell(r)} | ${r.match} |`,
  ),
  "",
  "Sanne's amount is read from her note: an approval is € 0,00; \"45,00 + btw\" is that amount plus VAT; " +
    "\"2 uur terugvragen\" is 2 hours at the contract rate plus VAT. Notes without an amount count as \"no amount given\".",
  "",
  "## Differences",
  "",
];

for (const r of differences) {
  const ex = EXPLANATIONS[r.file];
  const sanneSide =
    r.sanne.kind === "none" || r.sanneVerdict === "approve"
      ? r.sanneVerdict
      : `${r.sanneVerdict}, ${formatCents(r.sanne.cents)} (${r.sanne.how})`;
  md.push(
    `### ${r.invoiceNo} (${r.supplier}): ${r.match}`,
    "",
    `- **Sanne:** ${sanneSide}${r.note ? `; note: "${r.note}" (${r.english})` : ""}`,
    `- **Proposed:** ${r.ourVerdict}, ${formatCents(r.ours.disputeTotalCents)} incl. VAT`,
    `- **Decided by:** Article ${ex.articles.join(" + ")}`,
    "",
    ...ex.articles.flatMap((a) => [quote(a), ""]),
    ex.why(r),
    "",
  );
}

const rightApprovals = rows.filter((r) => r.agreesOnAmount && r.sanneVerdict === "approve");
const rightRules = rows.filter((r) => r.agreesOnVerdict && r.sanneVerdict === "dispute");
md.push(
  "## Where Sanne was right",
  "",
  `- **${rightApprovals.length} approvals we agree with:** ${rightApprovals.map((r) => r.invoiceNo).join(", ")}.`,
  ...rightRules.map((r) => {
    const f = disputes(r)[0];
    const amount =
      r.sanne.kind === "implied" && r.agreesOnAmount
        ? ` Her "${r.note}" works out to ${r.sanne.how}, exactly the proposed amount.`
        : "";
    const phrase = RULE_PHRASES[f.rule];
    if (!phrase) fail(`no rule phrase for Article ${f.rule} (${r.invoiceNo})`);
    return `- **${r.invoiceNo}:** she applied the right rule (Article ${f.rule}): ${phrase}.${amount}`;
  }),
  "",
);

// Facts for the process section, from the same rows.
const r0038 = rows.find((r) => r.file === "h-2026-0038.txt");
const r0102 = rows.find((r) => r.file === "b-B-26-0102.txt");
const r009 = rows.find((r) => r.file === "w-DW26-009.txt");
if (!r0038 || !r0102 || !r009) fail("process section needs 2026-0038, B-26-0102 and DW26-009");
const callout = r0102.invoice.lines.find((l) => l.lineNo === disputes(r0102)[0].lineNo)!;
const calloutPrice = getPrice(callout.code!, r0102.invoice.executionDate);
const wo009 = getWorkOrder(r009.ours.workOrder);
const ga = wo009.found ? wo009.meerwerkApproval : null;
if (!ga) fail("DW26-009: expected a GA approval");

md.push(
  "## What this suggests for Sanne's process",
  "",
  `- **She checks the invoice date, not the execution date.** 2026-0038 is dated ${enDate(r0038.invoice.invoiceDate)} for work done on ` +
    `${enDate(r0038.invoice.executionDate)}; 4.2 makes the execution date decisive. The tool reads the execution date from every invoice.`,
  `- **She uses the 2025 call-out price.** ${formatCents(calloutPrice.price2025Cents)} instead of the indexed ${formatCents(calloutPrice.price2026Cents)}. ` +
    `The tool looks up the price that applies on the execution date for every line.`,
  `- **She misses approvals in the work-order export.** ${ga.id} (${formatCents(ga.amountCents)}) on ${r009.ours.workOrder} covered DW26-009's meerwerk. ` +
    `In the audit call she said: *"${transcriptQuote("That export is a nightmare, it's one big file.")}"* and ` +
    `*"${transcriptQuote("To be honest, I don't always open it.")}"* The tool looks up every work order.`,
  `- **She believes ${formatCents(FREE_LIMIT_CENTS)} of unapproved meerwerk is paid.** Article 4.5 says nothing is; the tool applies that.`,
  "",
  `These are exactly the lookups the tool now does for her. Where she disputed and we agree ` +
    `(${rightRules.map((r) => r.invoiceNo).join(", ")}), she picked the right rule every time.`,
  "",
);

fs.writeFileSync(OUTPUT_FILE, md.join("\n"));
console.log(summary);
console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_FILE)} (${differences.length} differences explained).`);
