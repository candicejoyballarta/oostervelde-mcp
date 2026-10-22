import { listInvoiceFiles, parseInvoice } from "../parsers/index.js";
import { formatCents, roundDiv } from "../lib/money.js";
import { getWorkOrder } from "../lib/workOrders.js";
import type { Invoice } from "../types.js";
import type { CheckContext, CheckResult, Finding, RuleFinding } from "./types.js";
import { checkWorkOrder } from "./workOrder.js";
import { checkCallout } from "./callout.js";
import { checkOffList } from "./offList.js";
import { checkMeerwerk } from "./meerwerk.js";
import { checkPrices } from "./prices.js";
import { checkHours } from "./hours.js";
import { checkArithmetic } from "./arithmetic.js";
import { checkVat, vatFor } from "./vat.js";
import { checkDuplicate } from "./duplicates.js";
import { applyCredits, creditNoteFinding, creditNotesFor } from "./creditNotes.js";

let allCache: Invoice[] | null = null;
function allInvoices(): Invoice[] {
  allCache ??= listInvoiceFiles().map((file) => parseInvoice(file));
  return allCache;
}

/** Runs the single-invoice rules. Whole-line rules go first and claim their lines. */
function runRules(invoice: Invoice): RuleFinding[] {
  const lookup = getWorkOrder(invoice.workOrder);
  const workOrder = lookup.found ? lookup : null;
  const ctx: CheckContext = { invoice, workOrder, claimed: new Set() };

  const findings: RuleFinding[] = [...checkWorkOrder(invoice, workOrder)];
  for (const rule of [checkCallout, checkOffList, checkMeerwerk]) {
    for (const finding of rule(ctx)) {
      findings.push(finding);
      if (finding.claimsLine && finding.lineNo !== null) ctx.claimed.add(finding.lineNo);
    }
  }
  for (const rule of [checkPrices, checkHours, checkArithmetic, checkVat]) findings.push(...rule(ctx));
  return findings;
}

/**
 * Builds the corrected invoice from the findings' effects, and gives each
 * finding its dispute amounts:
 * - line reductions: excl + VAT at the line's corrected rate
 * - a lower VAT rate: billed line amount × (billed rate − correct rate)
 * - an overstated total: the difference itself
 */
function settle(invoice: Invoice, ruleFindings: RuleFinding[]): CheckResult {
  const lines = new Map(
    invoice.lines.map((l) => {
      const rate = l.vatRate ?? 21;
      return [l.lineNo, { billedAmount: l.amountCents, billedRate: rate, amount: l.amountCents, rate }];
    }),
  );
  for (const { effect, lineNo } of ruleFindings) {
    const line = lineNo !== null ? lines.get(lineNo) : undefined;
    if (!effect || !line) continue;
    if (effect.type === "reduceLine") line.amount -= effect.cents;
    if (effect.type === "lowerVatRate") line.rate = Math.min(line.rate, effect.rate);
  }

  const corrected = [...lines.values()];
  const correctedSubtotal = corrected.reduce((sum, l) => sum + l.amount, 0);
  const correctedTotal = correctedSubtotal + vatFor(corrected.map((l) => ({ amountCents: l.amount, rate: l.rate })));

  const findings: Finding[] = ruleFindings.map(({ effect, claimsLine, ...finding }) => {
    const line = finding.lineNo !== null ? lines.get(finding.lineNo) : undefined;
    let excl = 0;
    let incl = 0;
    if (effect?.type === "reduceLine" && line) {
      excl = effect.cents;
      incl = effect.cents + roundDiv(effect.cents * line.rate, 100);
    } else if (effect?.type === "lowerVatRate" && line) {
      incl = roundDiv(line.billedAmount * (line.billedRate - effect.rate), 100);
    } else if (effect?.type === "reduceTotal") {
      incl = effect.cents;
    }
    return { ...finding, disputeExclVatCents: excl, disputeInclVatCents: incl };
  });

  return finish(invoice, correctedTotal, findings);
}

/**
 * dispute = billed − corrected. Per-finding VAT rounding can differ from the
 * invoice-level rounding by a cent; that difference goes on the largest
 * finding, with an evidence line saying so.
 */
function finish(invoice: Invoice, correctedTotal: number, findings: Finding[]): CheckResult {
  const disputeTotal = invoice.totalCents - correctedTotal;
  const disputes = findings.filter((f) => f.kind === "dispute");
  const sum = () => disputes.reduce((total, f) => total + f.disputeInclVatCents, 0);

  const diff = disputeTotal - sum();
  if (diff !== 0 && disputes.length > 0 && Math.abs(diff) <= disputes.length) {
    const largest = disputes.reduce((a, b) => (b.disputeInclVatCents > a.disputeInclVatCents ? b : a));
    largest.disputeInclVatCents += diff;
    largest.evidence.push(
      `Rounding: ${diff > 0 ? "+" : ""}${formatCents(diff)} added so the findings add up to the invoice total (VAT is rounded per rate over the whole invoice)`,
    );
  }

  return {
    file: invoice.file,
    invoiceNo: invoice.invoiceNo,
    workOrder: invoice.workOrder,
    supplier: invoice.supplier,
    billedTotalCents: invoice.totalCents,
    correctedTotalCents: correctedTotal,
    creditedCents: 0,
    disputeTotalCents: disputeTotal,
    findings,
    reconciles: sum() === disputeTotal,
  };
}

/** All checks for one invoice, without credit notes applied. */
function checkOwn(invoice: Invoice): CheckResult {
  const duplicate = checkDuplicate(invoice);
  if (duplicate.fullDuplicate) return finish(invoice, 0, duplicate.findings);

  const result = settle(invoice, runRules(invoice));
  return { ...result, findings: [...duplicate.findings, ...result.findings] };
}

/** Checks one invoice file against Article 4. Findings only; no verdict. */
export function checkInvoice(file: string): CheckResult {
  const invoice = parseInvoice(file);
  const all = allInvoices();

  if (invoice.isCreditNote) {
    const original = all.find((inv) => !inv.isCreditNote && inv.invoiceNo === invoice.creditsInvoiceNo);
    const originalDispute = original ? checkOwn(original).disputeTotalCents : 0;
    return finish(invoice, invoice.totalCents, [creditNoteFinding(invoice, original, originalDispute)]);
  }

  return applyCredits(checkOwn(invoice), creditNotesFor(invoice, all));
}
