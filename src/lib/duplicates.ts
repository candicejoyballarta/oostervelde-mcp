import { listInvoiceFiles, parseInvoice } from "../parsers/index.js";
import type { Invoice } from "../types.js";

export type DuplicateGroup = {
  workOrder: string;
  invoices: {
    file: string;
    invoiceNo: string;
    invoiceDate: string;
    executionDate: string;
    totalCents: number;
    identicalLines: boolean; // same lines as at least one other invoice in the group
  }[];
};

/** Same number of lines, and per line the same code, quantity and amount, in order. */
function sameLines(a: Invoice, b: Invoice): boolean {
  if (a.lines.length !== b.lines.length) return false;
  return a.lines.every((line, i) => {
    const other = b.lines[i];
    return (
      line.code === other.code &&
      line.quantity === other.quantity &&
      line.amountCents === other.amountCents
    );
  });
}

/**
 * Contract 4.8: one invoice per work order. Returns every work order that has
 * more than one invoice. A credit note that references an invoice in the same
 * group is a correction, not a duplicate, so it is left out (the original stays,
 * so a real duplicate of a credited invoice would still show up).
 */
export function findDuplicates(): DuplicateGroup[] {
  const byWorkOrder = new Map<string, Invoice[]>();
  for (const file of listInvoiceFiles()) {
    const invoice = parseInvoice(file);
    if (invoice.workOrder === "") continue;
    const group = byWorkOrder.get(invoice.workOrder) ?? [];
    group.push(invoice);
    byWorkOrder.set(invoice.workOrder, group);
  }

  const groups: DuplicateGroup[] = [];
  for (const [workOrder, all] of byWorkOrder) {
    const invoiceNos = new Set(all.map((inv) => inv.invoiceNo));
    const invoices = all
      .filter((inv) => !(inv.isCreditNote && inv.creditsInvoiceNo && invoiceNos.has(inv.creditsInvoiceNo)))
      .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));
    if (invoices.length < 2) continue;

    groups.push({
      workOrder,
      invoices: invoices.map((inv) => ({
        file: inv.file,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.invoiceDate,
        executionDate: inv.executionDate,
        totalCents: inv.totalCents,
        identicalLines: invoices.some((other) => other !== inv && sameLines(inv, other)),
      })),
    });
  }
  return groups;
}
