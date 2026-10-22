export type Supplier = "Hoekstra" | "De Wit" | "Bosman" | "Jansen";

export type InvoiceLine = {
  lineNo: number;
  description: string; // as written on the invoice
  code: string | null; // matched price-list code (e.g. "H02"), null if no match
  isMeerwerk: boolean; // description starts with "Meerwerk:"
  quantity: number; // can be negative on credit notes
  unit: string; // "uur", "stuk", "m", "m2", "rol 25 m", "post", "keer", "dag", "liter"
  unitPriceCents: number;
  amountCents: number;
  vatRate: number | null; // per line for De Wit; from the invoice's VAT line otherwise
};

export type VatEntry = { rate: number; baseCents: number; amountCents: number };

export type Invoice = {
  file: string;
  invoiceNo: string;
  supplier: Supplier;
  isCreditNote: boolean;
  creditsInvoiceNo: string | null;
  workOrder: string; // "WO-26-1001"
  address: string;
  invoiceDate: string; // ISO yyyy-mm-dd
  executionDate: string; // ISO yyyy-mm-dd (date the work was done)
  lines: InvoiceLine[];
  subtotalCents: number;
  vat: VatEntry[];
  totalCents: number;
  warnings: string[];
};
