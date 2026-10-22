# review-list.csv format

UTF-8, comma-separated, header row first. Quote a field with double quotes when it contains a comma,
a quote or a newline (double any quotes inside it).

```text
invoice_file,invoice_no,supplier,work_order,proposed_verdict,label,rule,line_no,summary,billed_eur,expected_eur,dispute_excl_vat_eur,dispute_incl_vat_eur
```

- **One row per finding** (dispute, hold and info), in the same order as review-list.md.
- **One row per approved invoice with no findings**: rule, line_no, summary and the four euro columns empty.
- `proposed_verdict`: from `get_run_totals` (always the proposed one, even if Sanne decided otherwise).
- `label`: "Needs your judgement", "Rule-based, ready to send", or empty for approved invoices.
- `line_no`: the finding's `lineNo`; empty when it is null (whole invoice).
- Euro columns: the finding's `billedEur.csv`, `expectedEur.csv`, `disputeExclVatEur.csv`,
  `disputeInclVatEur.csv`: dot as the decimal separator, no thousands separator, no € sign
  (e.g. `1698.84`). Copy them; never convert cents yourself.
- **Info findings:** both dispute columns empty, so summing the column gives only real disputes. If
  billed and expected are both `0.00` (nothing to compare, e.g. an hours check within the limit), leave
  `billed_eur` and `expected_eur` empty as well.
- **Hold findings:** `expected_eur` empty (not determined while on hold).
