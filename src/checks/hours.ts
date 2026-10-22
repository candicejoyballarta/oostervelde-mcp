import { formatCents } from "../lib/money.js";
import { getPrice } from "../lib/prices.js";
import { LABOUR_CODES, type CheckContext, type RuleFinding } from "./types.js";

/**
 * 4.4: labour hours above the work order's maximum are only paid with an MU
 * approval. Allowed = max + approved extra hours. Excess hours are valued at
 * the lower of the correct and the billed rate, so a line that is both
 * overpriced and over-hours isn't disputed twice (the price check already
 * takes the overprice off every hour).
 */
export function checkHours({ invoice, workOrder, claimed }: CheckContext): RuleFinding[] {
  if (!workOrder || invoice.isCreditNote) return [];

  const labour = invoice.lines.filter(
    (line) => line.code && LABOUR_CODES.includes(line.code) && !claimed.has(line.lineNo),
  );
  if (labour.length === 0) return [];

  const billedHours = labour.reduce((sum, line) => sum + line.quantity, 0);
  const extra = workOrder.extraHoursApproval;
  const allowed = workOrder.maxLaborHours + (extra ? extra.hours : 0);
  const facts = [
    `${workOrder.wo} max labour hours: ${workOrder.maxLaborHours}`,
    extra
      ? `${workOrder.wo} extra hours approval: ${extra.id}, ${extra.hours} h → ${allowed} h allowed`
      : `${workOrder.wo} has no extra hours approval (MU)`,
  ];

  if (billedHours <= allowed) {
    if (!extra || billedHours <= workOrder.maxLaborHours) return [];
    return [
      {
        rule: "4.4",
        kind: "info",
        lineNo: null,
        summary: `${billedHours} hours billed, which is within the maximum plus approval ${extra.id}.`,
        billedCents: 0,
        expectedCents: 0,
        evidence: facts,
      },
    ];
  }

  // Take the excess off the last labour line (there is one per invoice in practice).
  const line = labour[labour.length - 1];
  const excessHours = billedHours - allowed;
  const correctRate = getPrice(line.code!, invoice.executionDate).appliesCents;
  const rate = Math.min(correctRate, line.unitPriceCents);
  const cents = excessHours * rate;

  return [
    {
      rule: "4.4",
      kind: "dispute",
      lineNo: line.lineNo,
      summary: `${billedHours} labour hours billed, but only ${allowed} are allowed on work order ${workOrder.wo}.`,
      billedCents: billedHours * line.unitPriceCents,
      expectedCents: billedHours * line.unitPriceCents - cents,
      evidence: [
        ...facts,
        `${billedHours} h billed − ${allowed} h allowed = ${excessHours} h × ${formatCents(rate)} = ${formatCents(cents)}`,
        rate === correctRate
          ? `Valued at the contract rate ${formatCents(correctRate)} (billed ${formatCents(line.unitPriceCents)})`
          : `Valued at the billed rate ${formatCents(rate)}, which is below the contract rate`,
      ],
      effect: { type: "reduceLine", cents },
    },
  ];
}
