import type { Invoice } from "../types.js";
import type { WorkOrder } from "../lib/workOrders.js";

export type FindingKind = "dispute" | "hold" | "info";

/** One finding as check_invoice returns it. */
export type Finding = {
  rule: string; // contract article, e.g. "4.3", or "arithmetic"
  kind: FindingKind;
  lineNo: number | null; // null = about the whole invoice
  summary: string; // one plain-English sentence
  billedCents: number;
  expectedCents: number;
  disputeExclVatCents: number;
  disputeInclVatCents: number;
  evidence: string[];
  lineDescription?: string | null; // the line's text as invoiced; set by check_invoice
  originalInvoiceNo?: string; // 4.8 duplicates: the invoice treated as the original
  originalInvoiceDateNl?: string; // its invoice date for Dutch letters, "2 januari 2026"
};

/**
 * How a dispute changes the corrected invoice:
 * - reduceLine: the line should have been this much lower (excl. VAT)
 * - lowerVatRate: the line should have had this lower VAT rate
 * - reduceTotal: the stated total is this much too high (the lines are fine)
 */
export type Effect =
  | { type: "reduceLine"; cents: number }
  | { type: "lowerVatRate"; rate: number }
  | { type: "reduceTotal"; cents: number };

/** What a rule returns. index.ts turns the effect into the dispute amounts. */
export type RuleFinding = Omit<Finding, "disputeExclVatCents" | "disputeInclVatCents"> & {
  effect?: Effect;
  claimsLine?: boolean; // the whole line is disputed; other line rules skip it
};

export type CheckContext = {
  invoice: Invoice;
  workOrder: WorkOrder | null; // null when the work order is unknown
  claimed: Set<number>; // lineNos already fully disputed by an earlier rule
};

/** check_invoice's result. */
export type CheckResult = {
  file: string;
  invoiceNo: string;
  workOrder: string;
  supplier: Invoice["supplier"];
  invoiceDate: string;
  invoiceDateNl: string; // "27 januari 2026", for Dutch letters
  executionDateNl: string; // date the work was done, "17 december 2025"
  address: string;
  billedTotalCents: number;
  correctedTotalCents: number;
  creditedCents: number; // already corrected by credit notes referencing this invoice
  disputeTotalCents: number; // billed − corrected − credited, from overcharges only
  findings: Finding[];
  reconciles: boolean; // Σ dispute findings incl. VAT === disputeTotalCents
};

// Price-list codes by role.
export const LABOUR_CODES = ["H02", "W01", "B01", "J01"];
export const CALLOUT_CODES = ["H06", "B05", "J05"];
export const REDUCED_VAT_CODES = ["W01", "W04"]; // painter labour (4.6)
