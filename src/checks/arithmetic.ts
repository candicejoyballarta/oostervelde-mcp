import { formatCents } from "../lib/money.js";
import type { CheckContext, RuleFinding } from "./types.js";

/**
 * The invoice's own maths: a line amount above quantity × unit price, and a
 * stated total above subtotal + VAT, are disputed by the difference.
 */
export function checkArithmetic({ invoice, claimed }: CheckContext): RuleFinding[] {
  if (invoice.isCreditNote) return [];
  const findings: RuleFinding[] = [];

  for (const line of invoice.lines) {
    if (claimed.has(line.lineNo)) continue;
    const expected = line.quantity * line.unitPriceCents;
    if (line.amountCents <= expected) continue;
    findings.push({
      rule: "arithmetic",
      kind: "dispute",
      lineNo: line.lineNo,
      summary: `The line amount is higher than quantity × unit price.`,
      billedCents: line.amountCents,
      expectedCents: expected,
      evidence: [
        `${line.quantity} ${line.unit} × ${formatCents(line.unitPriceCents)} = ${formatCents(expected)}`,
        `Invoice line says ${formatCents(line.amountCents)}: ${formatCents(line.amountCents - expected)} too high`,
      ],
      effect: { type: "reduceLine", cents: line.amountCents - expected },
    });
  }

  const vatTotal = invoice.vat.reduce((sum, v) => sum + v.amountCents, 0);
  const expectedTotal = invoice.subtotalCents + vatTotal;
  if (invoice.totalCents > expectedTotal) {
    findings.push({
      rule: "arithmetic",
      kind: "dispute",
      lineNo: null,
      summary: `The invoice total is higher than subtotal + VAT.`,
      billedCents: invoice.totalCents,
      expectedCents: expectedTotal,
      evidence: [
        `Subtotal ${formatCents(invoice.subtotalCents)} + VAT ${formatCents(vatTotal)} = ${formatCents(expectedTotal)}`,
        `Invoice total says ${formatCents(invoice.totalCents)}: ${formatCents(invoice.totalCents - expectedTotal)} too high`,
      ],
      effect: { type: "reduceTotal", cents: invoice.totalCents - expectedTotal },
    });
  }
  return findings;
}
