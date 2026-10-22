import { formatCents } from "../lib/money.js";
import { CALLOUT_CODES, type CheckContext, type RuleFinding } from "./types.js";

/**
 * 4.3: call-out fees only on spoed (emergency) work orders, at most once per
 * work order. On a regulier work order every call-out line is disputed; on a
 * spoed work order every one after the first.
 */
export function checkCallout({ invoice, workOrder }: CheckContext): RuleFinding[] {
  if (!workOrder) return [];

  const callouts = invoice.lines.filter((line) => line.code && CALLOUT_CODES.includes(line.code));
  const disputed = workOrder.type === "regulier" ? callouts : callouts.slice(1);

  return disputed.map((line) => ({
    rule: "4.3",
    kind: "dispute" as const,
    lineNo: line.lineNo,
    summary:
      workOrder.type === "regulier"
        ? `Call-out fee charged on a regular (regulier) work order; only emergency (spoed) work orders get call-out fees.`
        : `Call-out fee charged a second time; a spoed work order gets at most one call-out fee.`,
    billedCents: line.amountCents,
    expectedCents: 0,
    evidence: [
      `${workOrder.wo} type: ${workOrder.type}`,
      `Call-out lines on this invoice: ${callouts.map((l) => `line ${l.lineNo}`).join(", ")}`,
      `Line ${line.lineNo}: ${line.description}, ${formatCents(line.amountCents)}`,
    ],
    effect: { type: "reduceLine" as const, cents: line.amountCents },
    claimsLine: true,
  }));
}
