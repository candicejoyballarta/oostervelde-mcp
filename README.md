# Oostervelde invoice check

An MCP server and Claude skill that check Woonkring Oostervelde's contractor invoices against Article 4 of the framework
contract and prepare a review list, with proposed verdicts, evidence and draft Dutch dispute letters, for accounts
payable to decide on. Background and design decisions: [NOTES.md](NOTES.md).

## Development

All scripts run with `npx tsx scripts/<name>.ts` and exit non-zero on failure.

| Script | What it does |
| --- | --- |
| `parse-all.ts` | Parses all 40 invoices and checks each invoice's own arithmetic (expected invoice errors are listed explicitly). |
| `lookups-check.ts` | Checks the lookups: prices with indexation, work orders, contract articles, duplicates. |
| `checks-check.ts` | Runs `check_invoice` on all 40 against the Phase 0 answer key, plus spot checks for run totals, verdict counts, euro strings, Dutch dates and the decision log (on a temp file). |
| `review-list-check.ts` | Checks `output/review-list.md` and `.csv`: every euro amount must come from tool output, plus totals, verdict counts and one CSV row per invoice. |
| `compare-sanne.ts` | Writes `output/sanne-comparison.md`: Sanne's verdicts on the first 10 invoices next to the proposed ones, with the contract article behind each difference. |
