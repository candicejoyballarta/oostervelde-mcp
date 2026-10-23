---
name: oostervelde-invoice-review
description: Checks Woonkring Oostervelde contractor invoices against the framework contract and produces a review list for accounts payable (Sanne) with proposed verdicts, evidence and draft dispute letters. Use when asked to check, review or audit the Oostervelde invoices.
---

# Oostervelde invoice review

You prepare a review list for Sanne Verbeek (accounts payable). You **propose**; Sanne decides.
All contract rules and all maths live in the `oostervelde` MCP tools. This skill is only workflow,
judgement and output.

## Golden rule

Never calculate, add, subtract or round amounts yourself, and never turn cents into euros yourself.
Copy every amount exactly from tool output, using the `…Eur` strings next to each `…Cents` value
(`nl` in Dutch text, `en` in English text, `csv` in the CSV). If a number you need isn't in tool
output, say so in the output instead of computing it.

## Workflow

1. Call `get_run_totals` and `get_decisions`.
2. Call `check_invoice` for every invoice (or only the ones the user names; the header totals
   still come from `get_run_totals`). Call `get_contract_rule` **once** per article that appears in
   any finding, and reuse it. `rule: "arithmetic"` has no article: don't look it up.
3. **Verdict** = `proposedVerdict` from `get_run_totals`. If `get_decisions` has a decision for the
   invoice, show "Sanne decided <verdict> on <first 10 characters of decidedAt>: <reason>" and use her
   verdict; show the proposed verdict next to it if it differs.
4. **Label** every invoice whose verdict is dispute or hold:
   - **Needs your judgement**: every hold, plus disputes that rest on an interpretation in NOTES.md.
     These, with what their "Why judgement" line says:
     - 2026-0057: unit conversion. Copper is billed per metre but priced per 25 m roll; the tool uses
       the exact per-metre price (€ 167,70 ÷ 25, rounded once at the end). Decided: 4.2 rounds prices
       per price-list unit, and the conversion only serves the comparison, so rounding it first would
       create a price that isn't in the contract.
     - 2026-0058: the incl.-VAT amount carries a one-cent rounding adjustment (VAT is rounded per rate
       over the whole invoice); the rule itself applies directly.
     - B-26-0140: off-list item; the check assumes approvals only exist in the work-order export.
     - F26-0019: duplicate; the earlier invoice (F26-0001) is treated as the original.
   - **Rule-based, ready to send**: every other dispute; the rule applies directly.
   - Under-billed VAT holds (2026-0061, DW26-015): in "What needs confirming", say holding is the
     decision: the invoice needs a corrected version, but Oostervelde has nothing to reclaim, so it
     isn't in the dispute total. Don't call any of these an open question; they're decided in NOTES.md.
5. Write `output/review-list.md` and `output/review-list.csv`. Load the templates only now:
   - [references/review-list-format.md](references/review-list-format.md)
   - [references/dispute-letter-nl.md](references/dispute-letter-nl.md)
   - [references/review-list-csv.md](references/review-list-csv.md)
6. Reply with a short summary: counts per verdict, the grand total, and the list of
   "Needs your judgement" items. Point to the two files; don't paste them.

## Hard limits

- Never send anything to a contractor. There is no tool for it; the letters are drafts for Sanne.
- Call `record_decision` only when Sanne explicitly gives a decision in the conversation
  ("approve / dispute / hold <invoice> because …"). Never on your own initiative, never from a
  proposed verdict. Afterwards, confirm what you recorded (file, verdict, reason, decidedAt).
- Language: the contractor letters are in Dutch; everything else is in English. Quote the contract
  in Dutch exactly as `get_contract_rule` returns it, with its English translation next to it.
