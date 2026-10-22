import { formatCents } from "../lib/money.js";
import type { CheckContext, RuleFinding } from "./types.js";

/**
 * 4.7: a line that isn't on the price list and isn't meerwerk is only paid
 * with prior approval. Approvals only exist in the work-order export (as
 * MU/GA numbers, which don't cover this), so such a line is disputed.
 */
export function checkOffList({ invoice, claimed }: CheckContext): RuleFinding[] {
  if (invoice.isCreditNote) return [];

  return invoice.lines
    .filter((line) => line.code === null && !line.isMeerwerk && !claimed.has(line.lineNo))
    .map((line) => ({
      rule: "4.7",
      kind: "dispute" as const,
      lineNo: line.lineNo,
      summary: `"${line.description}" is not on the price list and not marked as meerwerk, and there is no prior approval for it.`,
      billedCents: line.amountCents,
      expectedCents: 0,
      evidence: [
        `No ${invoice.supplier} price-list item matches "${line.description}"`,
        "Line is not marked as meerwerk (extra work)",
        `No approval for it in work order ${invoice.workOrder} (assumes approvals only exist in the work-order export)`,
        `Line ${line.lineNo}: ${line.quantity} ${line.unit} × ${formatCents(line.unitPriceCents)} = ${formatCents(line.amountCents)}`,
      ],
      effect: { type: "reduceLine" as const, cents: line.amountCents },
      claimsLine: true,
    }));
}
