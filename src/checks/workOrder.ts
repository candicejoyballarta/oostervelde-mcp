import type { Invoice } from "../types.js";
import type { WorkOrder } from "../lib/workOrders.js";
import type { RuleFinding } from "./types.js";

// "Hoofdstraat 118,  Rheden" → "hoofdstraat 118, rheden"
const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * 4.9: the invoice must belong to a known work order. Unknown → hold (the
 * other work-order checks are then skipped). Known but for another supplier
 * or address → hold, because the work-order facts may not apply.
 */
export function checkWorkOrder(invoice: Invoice, workOrder: WorkOrder | null): RuleFinding[] {
  if (!workOrder) {
    return [
      {
        rule: "4.9",
        kind: "hold",
        lineNo: null,
        summary: `Work order ${invoice.workOrder || "(none)"} is not in the work-order export, so the invoice can't be paid until the job is confirmed.`,
        billedCents: invoice.totalCents,
        expectedCents: 0,
        evidence: [
          `${invoice.workOrder || "(none)"} not found in work-orders-export.csv`,
          "Call-out, hours, meerwerk and VAT-rate checks skipped (they need the work order)",
        ],
      },
    ];
  }

  const findings: RuleFinding[] = [];
  if (workOrder.supplier !== invoice.supplier) {
    findings.push({
      rule: "4.9",
      kind: "hold",
      lineNo: null,
      summary: `Work order ${workOrder.wo} belongs to ${workOrder.supplier}, but this invoice is from ${invoice.supplier}.`,
      billedCents: invoice.totalCents,
      expectedCents: 0,
      evidence: [`${workOrder.wo} supplier: ${workOrder.supplier}`, `Invoice supplier: ${invoice.supplier}`],
    });
  }
  if (normalize(workOrder.address) !== normalize(invoice.address)) {
    findings.push({
      rule: "4.9",
      kind: "hold",
      lineNo: null,
      summary: `The invoice address doesn't match the address on work order ${workOrder.wo}.`,
      billedCents: invoice.totalCents,
      expectedCents: 0,
      evidence: [`${workOrder.wo} address: ${workOrder.address}`, `Invoice address: ${invoice.address}`],
    });
  }
  return findings;
}
