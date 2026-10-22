import { findDuplicates } from "../lib/duplicates.js";
import { formatCents } from "../lib/money.js";
import { isoToDutchLong } from "../lib/dates.js";
import type { Invoice } from "../types.js";
import type { Finding } from "./types.js";

/**
 * 4.8: one invoice per work order. The earliest invoice (by invoice date) is
 * treated as the original. A later invoice with identical lines is disputed
 * in full; a later one with different lines goes on hold.
 */
export function checkDuplicate(invoice: Invoice): { findings: Finding[]; fullDuplicate: boolean } {
  const group = findDuplicates().find((g) => g.invoices.some((inv) => inv.file === invoice.file));
  if (!group) return { findings: [], fullDuplicate: false };

  const original = group.invoices[0];
  const others = group.invoices.filter((inv) => inv.file !== invoice.file);
  const evidence = group.invoices.map(
    (inv) =>
      `${inv.invoiceNo}: invoice date ${inv.invoiceDate}, work done ${inv.executionDate}, total ${formatCents(inv.totalCents)}`,
  );

  if (original.file === invoice.file) {
    return {
      fullDuplicate: false,
      findings: [
        {
          rule: "4.8",
          kind: "info",
          lineNo: null,
          summary: `Work order ${group.workOrder} is also billed on ${others.map((o) => o.invoiceNo).join(", ")}; this is the earliest invoice, so it is treated as the original.`,
          billedCents: invoice.totalCents,
          expectedCents: invoice.totalCents,
          disputeExclVatCents: 0,
          disputeInclVatCents: 0,
          evidence,
        },
      ],
    };
  }

  const originalRef = { originalInvoiceNo: original.invoiceNo, originalInvoiceDateNl: isoToDutchLong(original.invoiceDate) };
  const me = group.invoices.find((inv) => inv.file === invoice.file)!;
  if (me.identicalLines) {
    return {
      fullDuplicate: true,
      findings: [
        {
          rule: "4.8",
          kind: "dispute",
          lineNo: null,
          summary: `This invoice repeats ${original.invoiceNo} for the same work order ${group.workOrder}; a work order is invoiced only once.`,
          billedCents: invoice.totalCents,
          expectedCents: 0,
          disputeExclVatCents: invoice.subtotalCents,
          disputeInclVatCents: invoice.totalCents,
          evidence: [...evidence, `Same lines as ${original.invoiceNo}: codes, quantities and amounts identical`],
          ...originalRef,
        },
      ],
    };
  }

  return {
    fullDuplicate: false,
    findings: [
      {
        rule: "4.8",
        kind: "hold",
        lineNo: null,
        summary: `Work order ${group.workOrder} was already invoiced on ${original.invoiceNo}, with different lines; check whether this is a second job or a duplicate.`,
        billedCents: invoice.totalCents,
        expectedCents: 0,
        disputeExclVatCents: 0,
        disputeInclVatCents: 0,
        evidence,
        ...originalRef,
      },
    ],
  };
}
