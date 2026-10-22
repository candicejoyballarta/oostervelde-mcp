# Notes: Woonkring Oostervelde invoice check

MCP server + Claude skill that checks 40 Dutch contractor invoices against Article 4 of the
framework contract (*Raamovereenkomst*). Hand analysis and draft answer key: [docs/phase0-findings.md](docs/phase0-findings.md).
Sanne's current process is taken from the task audit call of 3 Feb 2026 ([data/task-audit-transcript.md](data/task-audit-transcript.md)).

## Decisions and translations

### Translations relied on

| Dutch | English | Used for |
| --- | --- | --- |
| Raamovereenkomst | Framework contract | |
| exclusief btw | excluding VAT | 4.1 |
| De eenheid in de prijslijst is leidend | The price-list unit is decisive | 4.1 unit conversion |
| omgerekend ... mag niet hoger uitkomen | converted ... may not come out higher | 4.1 |
| eenmalig geïndexeerd met 3,2 procent, afgerond op hele centen per eenheid | indexed once by 3.2%, rounded to whole cents per unit | 4.2 |
| Bepalend is de datum van uitvoering, niet de factuurdatum | The execution date decides, not the invoice date | 4.2 |
| Voorrijkosten | Call-out fee | 4.3 |
| spoed / regulier | emergency / regular (work-order type) | 4.3 |
| ten hoogste één keer per werkorder | at most once per work order | 4.3 |
| Arbeidsuren / vooraf goedgekeurd | Labour hours / approved in advance | 4.4 (MU-xxxx) |
| Meerwerk | Extra work (outside the work order) | 4.5 (GA-xxxx) |
| ook niet het deel tot EUR 250,00 | not even the part up to EUR 250.00 | 4.5 |
| ten hoogste het goedgekeurde bedrag | at most the approved amount | 4.5 |
| verlaagde tarief van 9 procent, uitsluitend over de arbeid | reduced 9% rate, only on labour (W01, W04) | 4.6 |
| woningen ouder dan twee jaar | homes older than two years | 4.6 |
| Leveringen buiten de prijslijst | Supplies outside the price list | 4.7 |
| Creditfactuur ... verrekent | Credit note ... netted against | 4.8 |
| Onbekende werkorder | Unknown work order | 4.9 |
| Het onbetwiste deel wordt wel betaald | The undisputed part is paid | 4.10 |
| Werkbon / Opdracht / Uw werkorder | Work order (per supplier layout) | parsing |
| Datum uitvoering / uitgevoerd (op) / Uitvoeringsdatum | Execution date (per layout) | 4.2 |
| post | lump sum | meerwerk lines |
| Vogelwering dakgoot | Gutter bird guard | 4.7 |

### Interpretation decisions

- **Old vs new prices follow the execution date (*datum uitvoering*), not the invoice date** — 4.2 says so explicitly. Sanne checks the invoice year ("I just check the invoice is from this year"); the contract says otherwise.
- **Indexation: 2025 price × 1.032, rounded half-up to whole cents per price-list unit** — 4.2 ("afgerond op hele centen per eenheid").
- **All money is handled as integer cents** — avoids float rounding errors. Built: `parseCents` in [src/lib/money.ts](src/lib/money.ts).
- **VAT is calculated per rate per invoice** — matches how all four suppliers invoice.
- **Hours over the maximum are valued at the lower of the contract rate and the billed rate** — with an overpriced rate, the price check already takes the overprice off every hour, so valuing the excess at the contract rate avoids counting it twice; with a rate below contract, using the billed rate keeps the dispute from exceeding what was charged.
- **Meerwerk (extra work) over €250.00 without a GA approval is not paid at all, not even the first €250.00** — 4.5 ("ook niet het deel tot EUR 250,00"). Sanne believed €250.00 would be paid ("I think if they don't have it, we only pay the 250?").
- **Meerwerk with a GA approval: at most the approved amount is paid** — 4.5.
- **Meerwerk is summed per invoice, not across invoices of the same work order** — 4.5 says "per werkorder", but in this dataset each work order has one invoice apart from the duplicate (F26-0001/F26-0019) and credit-note (2026-0049/C003) pairs, which are handled separately under 4.8.
- **Call-out fees (*voorrijkosten*) only on *spoed* (emergency) work orders, at most once per work order, at the indexed €46.44** — 4.3 + 4.2. Sanne knows the spoed rule but checks it "when I remember", and in her verdicts used €45.00, the 2025 price.
- **9% VAT only on painter labour (codes W01/W04) for homes older than two years; a 2025 new build gets 21%** — 4.6. Sanne checks "that the painter has two VAT lines"; that is not the test, the build year and line code are.
- **Off-list item without approval (gutter bird guard, *vogelwering dakgoot*, on B-26-0140) → dispute** — 4.7, assuming approvals only exist in the work-order export.
- **Duplicate invoices (F26-0001 and F26-0019, same work order WO-26-1013): the earlier one is the original, the later one is disputed in full** — 4.8 (one invoice per work order). Sanne checks invoices one by one and never compares them; last year a Jansen duplicate of almost €2,000.00 was paid and only came out at the year-end audit.
- **Credit note (*creditfactuur*) 2026-C003 is netted against 2026-0049** — 4.8. Same as Sanne's current practice.
- **Unknown work order (WO-26-1099 on DW26-013) → hold** — 4.9 (not paid until the order is confirmed). Same as Sanne's practice: on hold until the housing officer confirms the job.
- **Contractor letters are in Dutch; everything else (review list, CSV, summaries) is in English** — the contract and all four contractors are Dutch, so the letters quote the Dutch contract text verbatim; the review list shows each Dutch quote with its English translation and gives a one-line English gist under each letter. Dates in letters are written out in Dutch ("27 januari 2026"), from `invoiceDateNl` in `check_invoice`.
- **Proposed verdict rule (in code, `get_run_totals`)**: any hold finding → hold; else any dispute finding → dispute; else approve. Deterministic, so the same invoices always get the same proposal; Claude doesn't decide it.
- **Letters state both the billed and the correct invoice total (incl. VAT)** — VAT is rounded per rate over the whole invoice, so a single finding's incl.-VAT amount can differ by a cent from "excl. × rate" (2026-0058: € 56,20, not € 56,19). Stating "gefactureerd totaal" and "juist totaal" makes the dispute the difference of two totals the contractor can verify, so a one-cent rounding difference can't be disputed.
- **Duplicate letters ask for a credit note** — the later invoice isn't paid, and the contractor is asked to cancel it with a credit note referring to it (4.8), so their books match ours.
- **All amounts in the review list come from tool output** — every `…Cents` value has `…Eur` strings next to it (`nl`, `en`, `csv`); the skill copies them and never calculates, rounds or formats. `scripts/review-list-check.ts` fails on any euro amount in the output that isn't in tool output.

### Questions sent to MSTR (22 Oct 2026)

Status: **awaiting reply.** Until then I use the default shown.

1. **VAT charged too low** — 2026-0061 bills plumbing at 9%; DW26-015 bills a 2025 new build at 9%.
   Default: hold, request a corrected invoice, leave it out of the dispute total.
2. **Rounding in unit conversion** — 2026-0057 bills copper per metre; the price list prices it per 25 m roll. Exact €6.708/m gives a dispute of €21.68; rounded €6.71/m gives €21.60.
   Default: exact price, €21.68.
3. **Dispute total incl. or excl. VAT?**
   Default: show both; the headline total is incl. VAT.

## Where Sanne decides

Sanne in the audit call: "I'm the one who signs off. I'm not going to approve forty invoices on a computer's word."

- **The solution only proposes verdicts (approve / dispute / hold); Sanne makes every final decision.** `get_run_totals` gives the proposed verdict per invoice; the review list labels every total and verdict "proposed" and opens with "How to use this list" (proposed only; you decide; tell me your decision and I'll record it).
- **Every dispute and hold is labelled**:
  - *Rule-based, ready to send*: the rule applies directly.
  - *Needs your judgement*: every hold, plus disputes that rest on an interpretation: 2026-0057 (unit-conversion rounding), 2026-0058 (one-cent VAT rounding), B-26-0140 (off-list item; an approval may exist outside the work-order export) and F26-0019 (duplicate; the earlier invoice is treated as the original). Each says why in a "Why judgement" line. This replaces the earlier plan to put open-question findings on hold: they keep their default amount but are flagged for her.
- **Her decisions are logged, not overwritten**: `record_decision` appends `{file, verdict, reason, decidedBy, decidedAt}` to `state/decisions.json` (git-ignored, append-only), and only when she explicitly states a decision. `get_decisions` returns her latest decision per invoice; the review list then shows "Sanne decided … on …: …" next to the proposed verdict, plus a "Sanne's decisions" table under the header. Overrides are kept and can later become rule clarifications.
- **Recording a decision always needs a human click.** `.claude/settings.json` pre-allows the read/check tools (and edits under `output/`), so a review run doesn't stop for permission prompts; `record_decision` is deliberately left out, so Claude Code asks before every decision is written.
- **No tool can send anything to a contractor; nothing leaves without her.** There is no send tool; every tool reads local files except `record_decision`, which only writes the local log. Letters are marked "CONCEPT, pas versturen na akkoord van Sanne Verbeek".
- **Always goes to Sanne as "hold"**: built in `check_invoice` for unknown work orders, under-billed VAT, a work order with another supplier or address, a unit that can't be converted, and a home exactly two years old. Holds get no letter; instead a "What needs confirming" note, and the expected amount shows as "not determined (on hold)".
- **Every flag shows its evidence**: each finding has the line, the article (Dutch quote + English translation), billed vs expected, the amounts excl./incl. VAT and the evidence lines. She needs "the line, the rule, and the number", because contractors push back on anything less.
- **Every line is checked, whatever the amount.** Today Sanne skips the work-order export when "the amount is small"; the tool does the lookup she skips, but the verdict stays hers.
- **Dispute letters drafted for her to send.** Writing the emails takes her longer than finding the problem, so each dispute has a Dutch draft letter in the review list; she reviews and sends it herself.

## What changed along the way

- **Python → TypeScript.** Started planning in Python (`Decimal` for money); switched to TypeScript because it's my daily language. Money moved to integer cents instead of `Decimal`.
- **SDK examples are outdated.** While testing, I found that the Python MCP SDK v2 renamed `FastMCP` to `MCPServer`, so most tutorials no longer match. One reason to check the actual SDK version instead of trusting examples.
- **"Connection closed" in Claude Code.** The first registration ran the compiled `build/server.js`, but the TypeScript had never been built, so Node crashed on start (`Cannot find module ...\build\server.js`) and Claude Code only showed "Connection closed". Fixed by running the source directly through `tsx` (`npm run server:dev`, later `node --import tsx src/server.ts` in `.mcp.json`), so no build step is needed. Lesson: the real error is in the server's stderr, in Claude Code's MCP logs, not in the "connection closed" message.
- **Shorter tool descriptions.** Kept only what Claude can't infer: amounts are integer cents, and what `warnings` means. The input details, including where valid file names come from (`list_invoices`), moved into the field-level `file` description.
- **Path traversal blocked.** `get_invoice` only accepts file names that `list_invoices` returns, so e.g. `../package.json` returns `isError`.
- **Parser self-checks caught two errors my manual Phase 0 check had approved.** The checks (qty × price = amount, lines = subtotal, VAT bases = subtotal, subtotal + VAT = total) flagged:
  - 2026-0052: total €510.20 instead of €410.20, €100.00 too high.
  - DW26-016: 30 m² × €7.43 billed as €232.90 instead of €222.90, €10.90 incl. VAT too high.

  Lesson: verify the invoice's own arithmetic, not just prices and rules.
- **The review list is reproducible.** A fresh Claude Code session ran the skill end to end on all 40 invoices (~5–10 min) and produced output identical to the committed review list: same verdicts, labels, amounts and evidence. This shows the amounts come only from tools, not from the model's own arithmetic.
- **Test design.** The parse-all script treats the two invoice arithmetic errors as *expected invoice errors* with their exact warning text. It fails on any unexpected warning (parser bug) AND when an expected warning disappears (broken self-check). I chose this over "keep failing" (a permanently red test hides new failures) and over "mark as passing" (could hide future bugs), because it separates "the invoice is wrong" from "my code is wrong".

## What isn't finished

Built so far:

- the MCP server with `ping`, `list_invoices` and `get_invoice`
- parsers for all four supplier layouts into one JSON shape, with self-checks
- lookup tools `get_price` (with indexation), `get_work_order`, `get_contract_rule` and `find_duplicates`
- `check_invoice`: rule checks for 4.1–4.9 plus the invoice's own arithmetic, returning findings and a corrected invoice
- `get_run_totals` (proposed verdicts + totals), `record_decision` and `get_decisions`
- the Claude skill `.claude/skills/oostervelde-invoice-review/` with templates for the review list, the CSV and the Dutch dispute letters
- the full run on all 40 invoices: `output/review-list.md` and `output/review-list.csv`
- the comparison with Sanne's 10 verdicts, generated from the check code: `scripts/compare-sanne.ts` → `output/sanne-comparison.md` (8 of 10 agree on the verdict, 6 also on the amount)
- four test scripts (`parse-all.ts`, `lookups-check.ts`, `checks-check.ts`, `review-list-check.ts`); `checks-check.ts` matches all 40 dispute totals of the Phase 0 answer key (€3,412.47 in total) and the 20 / 3 / 17 proposed verdicts

Not built yet:

- **Untested branches.** The partial-credit-note, exactly-2-years and unknown-unit-mismatch branches have no examples in the data and are untested.
- **English versions of the letters** if a contractor asks for one (letters are Dutch only for now).
- **README with a 10-minute setup.**
- **Video.**
