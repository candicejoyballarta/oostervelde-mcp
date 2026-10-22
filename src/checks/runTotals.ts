import { listInvoiceFiles } from "../parsers/index.js";
import type { Supplier } from "../types.js";
import type { Verdict } from "../lib/decisions.js";
import { checkInvoice } from "./index.js";
import type { CheckResult } from "./types.js";

const SUPPLIER_ORDER: Supplier[] = ["Hoekstra", "De Wit", "Bosman", "Jansen"];

/** Proposed verdict only; Sanne decides. Any hold → hold; else any dispute → dispute; else approve. */
export function proposedVerdict(result: CheckResult): Verdict {
  if (result.findings.some((f) => f.kind === "hold")) return "hold";
  if (result.findings.some((f) => f.kind === "dispute")) return "dispute";
  return "approve";
}

/** check_invoice on every invoice, summed for the review list header. */
export function getRunTotals() {
  const invoices = listInvoiceFiles().map((file) => {
    const r = checkInvoice(file);
    return {
      file: r.file,
      invoiceNo: r.invoiceNo,
      supplier: r.supplier,
      proposedVerdict: proposedVerdict(r),
      disputeTotalCents: r.disputeTotalCents,
      hasHold: r.findings.some((f) => f.kind === "hold"),
      hasDispute: r.findings.some((f) => f.kind === "dispute"),
    };
  });

  const count = (verdict: Verdict) => invoices.filter((i) => i.proposedVerdict === verdict).length;
  return {
    invoiceCount: invoices.length,
    grandDisputeTotalCents: invoices.reduce((sum, i) => sum + i.disputeTotalCents, 0),
    perSupplier: SUPPLIER_ORDER.map((supplier) => {
      const own = invoices.filter((i) => i.supplier === supplier);
      return {
        supplier,
        invoices: own.length,
        disputeTotalCents: own.reduce((sum, i) => sum + i.disputeTotalCents, 0),
      };
    }),
    verdictCounts: { dispute: count("dispute"), hold: count("hold"), approve: count("approve") },
    invoices,
  };
}
