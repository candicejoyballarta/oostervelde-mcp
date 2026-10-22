import { formatCents } from "../lib/money.js";
import type { Invoice } from "../types.js";

// Sanity checks on the parsed numbers. A failure usually means a parser
// misread something; it is reported as a warning, never thrown.
export function selfChecks(invoice: Invoice): string[] {
  const warnings: string[] = [];
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

  // 1. quantity × unit price = line amount
  for (const line of invoice.lines) {
    const expected = line.quantity * line.unitPriceCents;
    if (expected !== line.amountCents) {
      warnings.push(
        `Line ${line.lineNo}: ${line.quantity} × ${formatCents(line.unitPriceCents)} = ` +
          `${formatCents(expected)}, but the line says ${formatCents(line.amountCents)}.`,
      );
    }
  }

  // 2. line amounts add up to the subtotal
  const linesTotal = sum(invoice.lines.map((line) => line.amountCents));
  if (linesTotal !== invoice.subtotalCents) {
    warnings.push(
      `Line amounts add up to ${formatCents(linesTotal)}, but the subtotal is ${formatCents(invoice.subtotalCents)}.`,
    );
  }

  // 3. VAT bases add up to the subtotal
  const vatBases = sum(invoice.vat.map((v) => v.baseCents));
  if (invoice.vat.length === 0) {
    warnings.push("No VAT lines found.");
  } else if (vatBases !== invoice.subtotalCents) {
    warnings.push(
      `VAT bases add up to ${formatCents(vatBases)}, but the subtotal is ${formatCents(invoice.subtotalCents)}.`,
    );
  }

  // 4. subtotal + VAT = total
  const expectedTotal = invoice.subtotalCents + sum(invoice.vat.map((v) => v.amountCents));
  if (expectedTotal !== invoice.totalCents) {
    warnings.push(
      `Subtotal + VAT = ${formatCents(expectedTotal)}, but the total is ${formatCents(invoice.totalCents)}.`,
    );
  }

  // 5. required fields are present
  const required = {
    invoiceNo: invoice.invoiceNo,
    workOrder: invoice.workOrder,
    executionDate: invoice.executionDate,
  };
  for (const [name, value] of Object.entries(required)) {
    if (value === "") warnings.push(`Missing required field: ${name}.`);
  }
  if (invoice.lines.length === 0) warnings.push("No invoice lines found.");

  return warnings;
}
