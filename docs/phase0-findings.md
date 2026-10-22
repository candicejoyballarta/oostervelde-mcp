# Phase 0 findings: Woonkring Oostervelde invoice check

Hand analysis of all 40 invoices against Article 4, before any code was written.
Amounts were checked with Python `Decimal`, rounding ROUND_HALF_UP. **This is a draft
answer key to test the MCP server and skill against. It is not output of the solution.**

## 1. Translations relied on

| Dutch | English | Used for |
|---|---|---|
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

## 2. Where Sanne's understanding differs from the contract

- **Indexation:** she checks the invoice year; 4.2 uses the execution date.
- **Meerwerk > €250 without approval:** she thinks €250 gets paid; 4.5 says €0.
- **Call-out fee amount:** she writes €45.00; the indexed price is €46.44.
- **Painter VAT:** "two VAT lines" isn't the test; it depends on build year + line code. A new build (2025) gets 21% on everything.
- **Duplicates / unit conversion / off-list items:** not in her process at all.

## 3. Indexed prices (2025 × 1.032, rounded per unit)

H01 2528.40 · H02 60.37 · H03 170.28 · H04 298.25 · H05 167.70 · H06 46.44 · H07 139.32 ·
W01 50.57 · W02 10.11 · W03 19.09 · W04 7.43 · B01 63.98 · B02 39.22 · B03 55.73 · B04 149.64 ·
B05 46.44 · J01 57.79 · J02 1217.76 · J03 40.76 · J04 24.77 · J05 46.44

## 4. Draft verdicts for all 40

Amounts are excl. VAT unless marked. "Incl." = amount + VAT at the line's rate.

### Dispute

| Invoice | WO | Issue | Rule | Excl. | Incl. |
|---|---|---|---|---|---|
| 2026-0038 | 1004 | Work done 17-12-2025, billed at 2026 prices (2×9.25 + 3×1.87) | 4.2 | 24.11 | 29.17 |
| 2026-0040 | 1021 | Work done 22-12-2025; boiler at 2026 price (labour correctly 2025, mixed) | 4.2 | 78.40 | 94.86 |
| 2026-0044 | 1007 | 8 h billed, max 6, no MU approval | 4.4 | 120.74 | 146.10 |
| 2026-0057 | 1014 | Copper billed €7.25/m; list price €167.70 per 25 m roll = €6.708/m | 4.1 | 21.68 ⚠ | 26.23 |
| 2026-0052 | 1036 | **Total wrong:** subtotal 339.01 + VAT 71.19 = 410.20, invoice says 510.20 | arithmetic / 4.10 | — | 100.00 |
| 2026-0058 | 1040 | Call-out fee billed twice on one spoed WO | 4.3 | 46.44 | 56.20 ⚠ |
| DW26-002 | 1030 | Painter labour at 21%, home built 1968 → 9% | 4.6 | — | 58.80 (VAT) |
| DW26-011 | 1008 | Painter labour at 21%, home built 1968 → 9% | 4.6 | — | 60.68 (VAT) |
| DW26-016 | 1017 | **Line wrong:** 30 m² × 7.43 = 222.90, invoice says 232.90 (VAT 9% then also 0.90 too high) | arithmetic | 10.00 | 10.90 |
| DW26-018 | 1022 | 14 h billed, max 12, no MU approval (VAT 9%) | 4.4 | 101.14 | 110.24 |
| F26-0016 | 1023 | Fuse box €1,245.00, list €1,217.76 | 4.1/4.2 | 27.24 | 32.96 |
| F26-0019 | 1013 | **Duplicate** of F26-0001 (same WO, date, lines, amount) | 4.8 | 1,404.00 | 1,698.84 |
| F26-0021 | 1019 | Call-out fee on regular WO | 4.3 | 46.44 | 56.19 |
| F26-0024 | 1028 | Meerwerk €310 > €250, no GA approval → none paid | 4.5 | 310.00 | 375.10 |
| B-26-0089 | 1038 | Work done 15-12-2025; bitumen at 2026 price (30×1.22) | 4.2 | 36.60 | 44.29 |
| B-26-0102 | 1005 | Call-out fee on regular WO | 4.3 | 46.44 | 56.19 |
| B-26-0127 | 1034 | 10 h billed, max 8 + MU-0241 1 h = 9 | 4.4 | 63.98 | 77.42 |
| B-26-0131 | 1015 | Meerwerk €640, GA-0419 approves €400 | 4.5 | 240.00 | 290.40 |
| B-26-0140 | 1020 | "Vogelwering" not on price list, not meerwerk | 4.7 | 58.50 ⚠ | 70.79 |
| B-26-0144 | 1029 | Roofer labour €66.00/h, list €63.98 (7 h) | 4.1/4.2 | 14.14 | 17.11 |

**Draft total to dispute: €3,412.47 incl. VAT** (depends on the open questions in section 6).

> Method (22 Oct): incl.-VAT dispute = billed invoice total − corrected invoice total, with VAT rounded per rate
> over the whole invoice (as the suppliers do). This equals "excl. × 1.21 rounded" everywhere except 2026-0058:
> billed VAT 86.80 − corrected VAT 77.04 = 9.76, not 46.44 × 21% = 9.75 → €56.20, not €56.19.

> Revision 22 Oct: 2026-0052 and DW26-016 were missed in the first hand check (approved by mistake).
> The parser's self-checks caught them. Lesson: arithmetic on the invoice itself must be verified, not just prices and rules.

### Hold

| Invoice | Why |
|---|---|
| DW26-013 | WO-26-1099 doesn't exist (4.9). Build year unknown, so VAT can't be checked either. |
| 2026-0061 ⚠ | Plumbing at 9% VAT, should be 21%: under-billed by €50.28. Needs a corrected invoice, not a refund. |
| DW26-015 ⚠ | New build (2025): labour + ceiling at 9%, should be 21%: under-billed by €90.28. |

### Approve

2026-0031, 2026-0035, 2026-0050 (roll unit matches), 2026-0063 (meerwerk €180 ≤ €250),
DW26-004, DW26-009 (GA-0412 covers €385), DW26-014 (18 + MU-0233 2 = 20 h), DW26-017,
F26-0001 (original of the duplicate), F26-0007, F26-0010, F26-0012, F26-0018,
B-26-0097, B-26-0099.

**2026-0049 + 2026-C003:** 0049 bills a call-out fee on a regular WO (4.3), but credit note C003 credits
exactly €46.44 + €9.75. Net = correct → approve both as a pair (4.8).

## 5. Comparison with Sanne's 10

| Invoice | Sanne | Mine | Why we differ |
|---|---|---|---|
| 2026-0031 | approve | approve | — |
| DW26-004 | approve | approve | — |
| F26-0007 | approve | approve | — |
| 2026-0038 | approve | **dispute €29.17** | She checked invoice date; 4.2 uses execution date (17-12-2025) |
| B-26-0102 | dispute €45 + VAT | dispute **€56.19** | Right rule, but the indexed call-out price is €46.44 |
| DW26-009 | dispute | **approve** | She missed GA-0412 (€400) in the work order |
| 2026-0044 | dispute 2 h | dispute €146.10 | Agree |
| DW26-011 | dispute | dispute €60.68 | Agree; amount = 12% of €505.70 |
| F26-0012 | approve | approve | — |
| B-26-0097 | approve | approve | — |

## 6. Interpretation decisions so far (⚠ = open question)

- VAT rounding: per rate per invoice (matches how all four suppliers invoice).
- Dispute amounts reported excl. VAT and incl. VAT; the dispute total is incl. VAT, since that's what would be paid.
- Hours over the max are valued at the contract rate, not the billed rate, so an overpriced and over-hours line isn't counted twice.
- Duplicate: the earlier invoice is treated as the original.
- ⚠ Unit conversion rounding (2026-0057): €6.708/m exact → €21.68; €6.71/m rounded → €21.60.
- ⚠ Under-billed VAT (2026-0061, DW26-015): put on hold, not counted in the dispute total.
- ⚠ Off-list item (B-26-0140): dispute, unless approvals can exist outside the WO export.
