# review-list.md format

English throughout, except the Dutch letters. Every amount is copied from a `…Eur` string in tool
output (`nl` form, e.g. "€ 56,20"). Never write an amount that isn't in tool output.

## 1. Header

```markdown
# Invoice review list: Woonkring Oostervelde

Run date: <today, yyyy-mm-dd> · <invoiceCount> invoices checked against Article 4 of the framework contract

## Proposed totals

| Supplier | Invoices | Proposed dispute (incl. VAT) |
| --- | --- | --- |
| <perSupplier[].supplier> | <invoices> | <disputeTotalEur.nl> |
| **Total** | <invoiceCount> | **<grandDisputeTotalEur.nl>** |

Proposed verdicts: <verdictCounts.dispute> dispute · <verdictCounts.hold> hold · <verdictCounts.approve> approve

## How to use this list

- These are **proposed** verdicts only. Nothing has been sent to any contractor.
- You decide every invoice. Check the evidence and the draft letter before sending anything.
- Tell me "approve / dispute / hold <invoice> because …" and I'll record your decision.
```

If `get_decisions` returns any decisions, add this right under the header totals:

```markdown
## Sanne's decisions

| Invoice | Proposed | Decided | Date | Reason |
| --- | --- | --- | --- | --- |
| <invoiceNo> | <proposedVerdict> | <verdict> | <decidedAt, first 10 chars> | <reason> |
```

If there are none, leave this section out.

## 2. Sections, in this order

1. `## Needs your judgement`: holds and judgement-labelled disputes
2. `## Disputes ready to send`: rule-based disputes
3. `## Approved`: one line each

Within a section, order by supplier (Hoekstra, De Wit, Bosman, Jansen), then by invoice number.

## 3. Per disputed or held invoice

```markdown
### <invoiceNo> · <supplier> · <verdict>

**<label>** · Work order <workOrder> · <address> · Invoice date <invoiceDate>
Billed <billedTotalEur.nl> · Disputed <disputeTotalEur.nl> incl. VAT
<If Sanne decided: "Sanne decided <verdict> on <date>: <reason>" (+ "proposed: <proposedVerdict>" if different)>

#### Line <lineNo or "whole invoice">: <lineDescription, if any>

- **What's wrong:** <summary>
- **Contract:** Article <rule>: "<Dutch text from get_contract_rule>" (<English translation>)
  For `rule: "arithmetic"`: "Invoice arithmetic: the invoice's own amounts don't add up (no article needed)."
- **Billed vs expected:** <billedEur.nl> billed, <expectedEur.nl> expected
  For a **hold** finding: "<billedEur.nl> billed, expected not determined (on hold)".
- **Amount:** <disputeExclVatEur.nl> excl. VAT · <disputeInclVatEur.nl> incl. VAT
  For a **hold** finding: "not determined (on hold)".
- **Evidence:**
  - <each evidence line, verbatim>
```

Repeat the `####` block for every dispute and hold finding. Info findings on a disputed invoice go in
one line at the end: "Also noted: <summary>", with no dispute amounts.

For a judgement-labelled dispute, add one line under the header: "Why judgement: <the interpretation
it rests on>".

Then:

- **Dispute:** `#### Draft letter (Dutch)`, filled from
  [dispute-letter-nl.md](dispute-letter-nl.md) in a blockquote, followed by
  `*Gist: <one English sentence>*`.
- **Hold:** no letter. Add `#### What needs confirming`: 1–3 bullets on what Sanne must find out before
  it can be paid or disputed (e.g. ask the housing officer to confirm work order WO-26-1099; ask the
  contractor for a corrected invoice with the right VAT).

## 4. Approved

One line per invoice: `- **<invoiceNo>** (<supplier>): <reason>`. The reason comes from the info
findings when there are any (e.g. "GA-0412 covers the €385 extra work"), otherwise "No findings;
every line matches the contract."

Show **2026-0049 and 2026-C003 as one entry**:
`- **2026-0049 + 2026-C003** (Hoekstra): Approve both together; the credit note cancels the call-out
fee on 0049 (net <2026-0049 correctedTotalEur.nl>).`
