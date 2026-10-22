// English translations of Article 4 of the framework contract
// (data/contract-excerpt.md). The Dutch text is the source; these are for
// readers who don't read Dutch.

export const CONTRACT_TRANSLATIONS: Record<
  string,
  { title: string; english: string }
> = {
  "4.1": {
    title: "Prices",
    english:
      "All prices are exclusive of VAT and are listed in the price list (Annex A, `price-agreement-2025.csv`). " +
      "The unit in the price list is decisive. If the contractor invoices in a different unit, the price per unit " +
      "is converted to the price-list unit and may not come out higher.",
  },
  "4.2": {
    title: "Indexation",
    english:
      "As of 1 January 2026, the prices are indexed once by 3.2 percent, rounded to whole cents per unit. " +
      "The date on which the work was carried out is decisive, not the invoice date. " +
      "Work carried out up to and including 31 December 2025 is invoiced at the 2025 prices.",
  },
  "4.3": {
    title: "Call-out fees",
    english:
      "Call-out fees (voorrijkosten) are only reimbursed for work orders of the type spoed (emergency), " +
      "and at most once per work order. For regular (regulier) work, call-out fees are included in the prices.",
  },
  "4.4": {
    title: "Labour hours",
    english:
      "Each work order states the maximum number of labour hours. Hours above that are only reimbursed if " +
      "Woonkring Oostervelde approved extra hours in advance. That approval is recorded in the work order, " +
      "with a number MU-xxxx and the number of approved extra hours.",
  },
  "4.5": {
    title: "Extra work",
    english:
      "Work outside the work order is listed separately on the invoice as meerwerk (extra work). " +
      "Meerwerk up to and including EUR 250.00 excluding VAT per work order may be carried out without prior approval. " +
      "Above that amount, prior written approval is required, recorded in the work order with a number GA-xxxx " +
      "and an approved amount. Without approval, meerwerk above EUR 250.00 is not reimbursed, " +
      "not even the part up to EUR 250.00. With approval, at most the approved amount is reimbursed.",
  },
  "4.6": {
    title: "VAT",
    english:
      "Painting work on homes older than two years is subject to the reduced rate of 9 percent, " +
      "only on the labour (price-list codes W01 and W04). Materials and all other work are subject to 21 percent. " +
      "The build year is stated in the work order.",
  },
  "4.7": {
    title: "Supplies outside the price list",
    english:
      "Supplies or work that are not in the price list and are not listed as meerwerk (extra work) " +
      "are only reimbursed after prior approval from Woonkring Oostervelde.",
  },
  "4.8": {
    title: "One invoice per work order",
    english:
      "Each work order is invoiced once. Corrections are made through a credit note that refers to the original invoice. " +
      "Woonkring Oostervelde nets the credit note against that invoice.",
  },
  "4.9": {
    title: "Unknown work orders",
    english:
      "An invoice without a valid Woonkring Oostervelde work order is not paid until the assignment has been confirmed.",
  },
  "4.10": {
    title: "Payment",
    english:
      "Woonkring Oostervelde pays approved invoices within 30 days of receipt. " +
      "Disputed invoices or invoice lines are reported to the contractor in writing, with the reason, " +
      "within 10 working days. The undisputed part is paid.",
  },
};
