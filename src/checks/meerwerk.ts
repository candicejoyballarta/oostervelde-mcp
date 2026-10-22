import { formatCents } from "../lib/money.js";
import type { CheckContext, RuleFinding } from "./types.js";

export const FREE_LIMIT_CENTS = 25000; // EUR 250,00 excl. VAT per work order

/**
 * 4.5: meerwerk (extra work) up to EUR 250,00 needs no approval. Above that it
 * needs a GA approval; without one the WHOLE amount is disputed (not even the
 * first 250,00 is paid). With one, at most the approved amount is paid.
 * Meerwerk is summed per invoice.
 */
export function checkMeerwerk({ invoice, workOrder }: CheckContext): RuleFinding[] {
  if (!workOrder) return [];

  const lines = invoice.lines.filter((line) => line.isMeerwerk);
  if (lines.length === 0) return [];

  const total = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const approval = workOrder.meerwerkApproval;
  const facts = [
    `Meerwerk on this invoice: ${lines.map((l) => `line ${l.lineNo} ${formatCents(l.amountCents)}`).join(", ")} = ${formatCents(total)}`,
    approval
      ? `${workOrder.wo} meerwerk approval: ${approval.id}, ${formatCents(approval.amountCents)}`
      : `${workOrder.wo} has no meerwerk approval (GA)`,
  ];

  // How much of the meerwerk is not paid.
  let excess: number;
  if (approval) excess = Math.max(0, total - approval.amountCents);
  else excess = total > FREE_LIMIT_CENTS ? total : 0;

  if (excess === 0) {
    return [
      {
        rule: "4.5",
        kind: "info",
        lineNo: null,
        summary: approval
          ? `Meerwerk of ${formatCents(total)} is covered by approval ${approval.id}.`
          : `Meerwerk of ${formatCents(total)} is within the ${formatCents(FREE_LIMIT_CENTS)} that needs no approval.`,
        billedCents: total,
        expectedCents: total,
        evidence: facts,
      },
    ];
  }

  // Take the excess off the meerwerk lines, last line first.
  const findings: RuleFinding[] = [];
  let left = excess;
  for (const line of [...lines].reverse()) {
    if (left === 0) break;
    const cut = Math.min(left, line.amountCents);
    left -= cut;
    findings.push({
      rule: "4.5",
      kind: "dispute",
      lineNo: line.lineNo,
      summary: approval
        ? `Meerwerk exceeds approval ${approval.id}; only the approved ${formatCents(approval.amountCents)} is paid.`
        : `Meerwerk of ${formatCents(total)} is above ${formatCents(FREE_LIMIT_CENTS)} without a GA approval, so none of it is paid, not even the first ${formatCents(FREE_LIMIT_CENTS)}.`,
      billedCents: line.amountCents,
      expectedCents: line.amountCents - cut,
      evidence: approval
        ? [...facts, `${formatCents(total)} − ${formatCents(approval.amountCents)} approved = ${formatCents(excess)} not covered`]
        : [...facts, "Contract 4.5: without approval, \"ook niet het deel tot EUR 250,00\" (not even the part up to EUR 250.00)"],
      effect: { type: "reduceLine", cents: cut },
      claimsLine: true,
    });
  }
  return findings.reverse();
}
