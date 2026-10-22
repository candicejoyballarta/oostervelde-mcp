# Oostervelde invoice check

An MCP server and Claude skill that check Woonkring Oostervelde's 40 January contractor invoices against Article 4 of
the framework contract (*Raamovereenkomst*). For each invoice it proposes **approve, dispute or hold**, with the
evidence and a Dutch draft dispute letter; Sanne Verbeek (accounts payable) makes every final decision.
Results: [output/review-list.md](output/review-list.md) (+ [.csv](output/review-list.csv)) and
[output/sanne-comparison.md](output/sanne-comparison.md). Design decisions: [NOTES.md](NOTES.md).

## Results at a glance

**Proposed verdicts: 20 dispute · 3 hold · 17 approve.** Grand total to dispute: **€ 3.412,47** incl. VAT.

| Supplier | Proposed dispute (incl. VAT) |
| --- | --- |
| Hoekstra | € 452,56 |
| De Wit | € 240,62 |
| Bosman | € 556,20 |
| Jansen | € 2.163,09 |

**Needs your judgement** (7). The other 16 disputes follow directly from a contract rule:

| Invoice | Supplier | Proposed | Why it needs Sanne |
| --- | --- | --- | --- |
| 2026-0057 | Hoekstra | dispute € 26,23 | Rests on how the per-roll copper price is converted to per metre and rounded. |
| 2026-0058 | Hoekstra | dispute € 56,20 | Second call-out fee; the amount includes a one-cent VAT rounding adjustment. |
| 2026-0061 | Hoekstra | hold | VAT is € 50,28 too low; needs a corrected invoice. |
| DW26-013 | De Wit | hold | Work order WO-26-1099 isn't in the export; the job needs confirming. |
| DW26-015 | De Wit | hold | VAT is € 90,28 too low (2025 new build, so 9% doesn't apply). |
| B-26-0140 | Bosman | dispute € 70,79 | Off-list item; it may have been approved outside the work-order export. |
| F26-0019 | Jansen | dispute € 1.698,84 | Duplicate of F26-0001; the earlier invoice is treated as the original. |

**Compared with Sanne's own verdicts on the first 10 invoices:** 8 of 10 agree on the verdict; 6 of those also on the
amount. The differences come from the execution date (4.2), an approval in the work-order export (4.5) and the indexed
call-out price (4.2 + 4.3); see [output/sanne-comparison.md](output/sanne-comparison.md).

## Requirements

- **Node.js 20.6 or newer** (tested with 24.20). The server is started with `node --import tsx`, which needs 20.6+.
- **Claude Code**, logged in (tested with 2.1.306).
- git and npm.

## Run it in 10 minutes

Setup ~3 min; the review run ~5–10 min. For a quick verification without running the skill, use the scripts under
[Verify the results](#verify-the-results) (under a minute).

1. Clone and enter the repo:

   ```sh
   git clone https://github.com/candicejoyballarta/oostervelde-mcp.git
   cd oostervelde-mcp
   ```

2. Install dependencies (about 30 s):

   ```sh
   npm install
   ```

   npm 11 may warn that install scripts for `esbuild` and `@modelcontextprotocol/inspector` weren't run. That's fine:
   everything here works without them.

3. Start Claude Code in the repo folder and trust the folder when asked:

   ```sh
   claude
   ```

   The MCP server `oostervelde` is registered in [.mcp.json](.mcp.json); [.claude/settings.json](.claude/settings.json)
   enables it and pre-allows the read/check tools, so the run doesn't stop for permission prompts.
4. Type `/mcp` and check that **oostervelde** shows as connected.
5. Run the review:

   ```text
   /oostervelde-invoice-review
   ```

   It writes `output/review-list.md` and `output/review-list.csv`, with the same verdicts and amounts as the committed
   list; the run date and some wording may differ. Verify with `npx tsx scripts/review-list-check.ts`. This overwrites
   `output/`; `git checkout output/` restores the submitted version.

**If `/mcp` shows "connection closed"** (or "failed"): run the server by hand in the repo folder to see the real error:

```sh
npx tsx src/server.ts
```

It should print `oostervelde MCP server running on stdio` and then wait (Ctrl+C to stop). If it prints an error
instead, the usual causes are a skipped `npm install` or Node older than 20.6.

## Try the human-in-the-loop part

Claude only proposes; decisions are Sanne's. Tell Claude, for example:

```text
Approve 2026-0058 because a one-cent difference isn't worth an email
```

Claude calls `record_decision`. Claude Code **asks for permission first**, because that tool is deliberately not
pre-allowed. The decision is appended to `state/decisions.json` (git-ignored, append-only). Then ask:

```text
Show Sanne's decisions
```

That calls `get_decisions` and shows the latest decision per invoice with its date and reason. Optionally, run
`/oostervelde-invoice-review` again: the list now shows "Sanne decided approve on …" next to the proposed verdict, plus
a "Sanne's decisions" table under the header.

To get back to the submitted state, delete the `state/` folder (and run `git checkout output/` if you re-ran the review).

## Verify the results

All scripts run with `npx tsx scripts/<name>.ts` from the repo folder, take a few seconds each, and exit non-zero
on failure. None of them change tracked files, so `git status` stays clean.

| Script | What it does | Pass looks like |
| --- | --- | --- |
| `parse-all.ts` | Parses all 40 invoices and checks each invoice's own arithmetic (expected invoice errors are listed explicitly). | `All checks passed.` |
| `lookups-check.ts` | Checks the lookups: prices with indexation, work orders, contract articles, duplicates. | `All checks passed.` |
| `checks-check.ts` | Runs `check_invoice` on all 40 against the Phase 0 answer key, plus spot checks for run totals, verdict counts, euro strings, Dutch dates and the decision log (on a temp file). | `All checks passed.` |
| `review-list-check.ts` | Checks `output/review-list.md` and `.csv` (every euro amount must come from tool output, totals, verdict counts, one CSV row per invoice) and that the numbers in this README match the output files. | `All checks passed.` |
| `compare-sanne.ts` | Regenerates `output/sanne-comparison.md`: Sanne's verdicts on the first 10 invoices next to the proposed ones, with the contract article behind each difference. | `8 of 10 agree on the verdict; 6 of those also on the amount.` followed by `output/sanne-comparison.md is up to date` |

Type check: `npx tsc --noEmit` (no output means it passed).

## Project layout

```text
src/
  server.ts          MCP server: registers the tools
  parsers/           one parser per supplier layout → one invoice shape, with self-checks
  lib/               money (integer cents), dates, prices, work orders, contract, duplicates, decision log
  checks/            check_invoice: one file per Article 4 rule, plus run totals (proposed verdicts)
scripts/             the verification scripts above
.claude/
  skills/oostervelde-invoice-review/   the skill: SKILL.md + templates in references/
  settings.json      enables the server, pre-allows read/check tools
data/                invoices, price list, work-order export, contract excerpt, audit transcript, Sanne's verdicts
docs/                phase0-findings.md: hand analysis before any code
output/              review-list.md, review-list.csv, sanne-comparison.md
state/               decisions.json once Sanne records a decision (git-ignored)
```

## Where to read more

- [NOTES.md](NOTES.md):
  - **Decisions and translations**: the Dutch terms relied on, every interpretation choice, open questions.
  - **Where Sanne decides**: proposed verdicts only, labels, the decision log, no send tool.
  - **What changed along the way**: what went wrong and what I changed.
  - **What isn't finished**.
- [docs/phase0-findings.md](docs/phase0-findings.md): the hand analysis of all 40 invoices, done before coding; the
  answer key the tests check against.
