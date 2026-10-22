import { formatCents } from "../lib/money.js";
import type { Invoice } from "../types.js";
import type { CheckResult, Finding } from "./types.js";

/** Credit notes whose "Betreft creditering van factuur X" points at this invoice. */
export function creditNotesFor(invoice: Invoice, all: Invoice[]): Invoice[] {
  return all.filter((inv) => inv.isCreditNote && inv.creditsInvoiceNo === invoice.invoiceNo);
}

/**
 * 4.8: a credit note is netted against the invoice it refers to.
 * - Exactly cancels the dispute → the findings stay, as "info", dispute 0.
 * - Covers part → findings become "info", plus one dispute for the remainder.
 * - Covers more than the dispute → hold.
 */
export function applyCredits(result: CheckResult, credits: Invoice[]): CheckResult {
  if (credits.length === 0) return result;

  const credited = -credits.reduce((sum, c) => sum + c.totalCents, 0);
  const creditedExcl = -credits.reduce((sum, c) => sum + c.subtotalCents, 0);
  const names = credits.map((c) => c.invoiceNo).join(", ");
  const dispute = result.disputeTotalCents;
  const creditEvidence = credits.map(
    (c) => `Credit note ${c.invoiceNo} (${c.file}): ${formatCents(c.totalCents)} incl. VAT, refers to ${result.invoiceNo}`,
  );

  // The original dispute findings become info, marked as (partly) resolved.
  const resolved = (note: string): Finding[] =>
    result.findings.map((f) =>
      f.kind === "dispute" ? { ...f, kind: "info", summary: `${f.summary} (${note})`, evidence: [...f.evidence, ...creditEvidence] } : f,
    );

  if (credited === dispute) {
    return {
      ...result,
      creditedCents: credited,
      disputeTotalCents: 0,
      findings: [
        ...resolved(`resolved by credit note ${names}`),
        {
          rule: "4.8",
          kind: "info",
          lineNo: null,
          summary: `Credit note ${names} cancels the disputed ${formatCents(dispute)} exactly; nothing left to dispute.`,
          billedCents: dispute,
          expectedCents: dispute,
          disputeExclVatCents: 0,
          disputeInclVatCents: 0,
          evidence: creditEvidence,
        },
      ],
      reconciles: true,
    };
  }

  if (credited < dispute) {
    const exclDisputed = result.findings
      .filter((f) => f.kind === "dispute")
      .reduce((sum, f) => sum + f.disputeExclVatCents, 0);
    const remainder = dispute - credited;
    return {
      ...result,
      creditedCents: credited,
      disputeTotalCents: remainder,
      findings: [
        ...resolved(`partly resolved by credit note ${names}`),
        {
          rule: "4.8",
          kind: "dispute",
          lineNo: null,
          summary: `Credit note ${names} covers ${formatCents(credited)} of the disputed ${formatCents(dispute)}; the remaining ${formatCents(remainder)} is still disputed.`,
          billedCents: dispute,
          expectedCents: credited,
          disputeExclVatCents: exclDisputed - creditedExcl,
          disputeInclVatCents: remainder,
          evidence: [...creditEvidence, `${formatCents(dispute)} disputed − ${formatCents(credited)} credited = ${formatCents(remainder)}`],
        },
      ],
      reconciles: true,
    };
  }

  return {
    ...result,
    creditedCents: credited,
    disputeTotalCents: 0,
    findings: [
      ...resolved(`credit note ${names} received`),
      {
        rule: "4.8",
        kind: "hold",
        lineNo: null,
        summary: `Credit note ${names} credits ${formatCents(credited)}, more than the ${formatCents(dispute)} found wrong on this invoice.`,
        billedCents: credited,
        expectedCents: dispute,
        disputeExclVatCents: 0,
        disputeInclVatCents: 0,
        evidence: creditEvidence,
      },
    ],
    reconciles: true,
  };
}

/** The finding shown on the credit note itself (no other checks run on it). */
export function creditNoteFinding(creditNote: Invoice, original: Invoice | undefined, originalDispute: number): Finding {
  const credited = -creditNote.totalCents;
  const relation = !original
    ? `the referenced invoice ${creditNote.creditsInvoiceNo} is not among the invoices`
    : credited === originalDispute
      ? `it cancels the ${formatCents(originalDispute)} disputed on ${original.invoiceNo} exactly`
      : `${formatCents(originalDispute)} was found wrong on ${original.invoiceNo}`;
  return {
    rule: "4.8",
    kind: "info",
    lineNo: null,
    summary: `Credit note for invoice ${creditNote.creditsInvoiceNo ?? "(unknown)"} of ${formatCents(credited)}; ${relation}.`,
    billedCents: creditNote.totalCents,
    expectedCents: creditNote.totalCents,
    disputeExclVatCents: 0,
    disputeInclVatCents: 0,
    evidence: [
      `Credit note ${creditNote.invoiceNo}: "Betreft creditering van factuur ${creditNote.creditsInvoiceNo}"`,
      ...(original ? [`${original.invoiceNo} (${original.file}) total ${formatCents(original.totalCents)}`] : []),
    ],
  };
}
