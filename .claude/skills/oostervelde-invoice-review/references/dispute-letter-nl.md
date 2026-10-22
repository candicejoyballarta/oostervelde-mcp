# Dispute letter template (Dutch)

Fill this in from tool output only. Amounts are `…Eur.nl` strings and dates are `…DateNl` strings. The
Dutch explanation is a faithful translation of the finding's `summary`; it may add a fact from the
finding's `evidence` (a rate, a sum, an approval number), copied exactly, but nothing that isn't in tool
output. The contract quote is copied verbatim from `get_contract_rule(...).dutch`: the full article, or the
sentences that apply, word for word.

```text
CONCEPT, pas versturen na akkoord van Sanne Verbeek

Onderwerp: Betwisting factuur {invoiceNo} (werkorder {workOrder})

Geachte heer, mevrouw,

Bij controle van factuur {invoiceNo} van {invoiceDateNl} voor werkorder {workOrder} ({address}) hebben wij het volgende geconstateerd:

{for each dispute finding:}
- Regel {lineNo}, "{lineDescription}": {Dutch explanation}. Artikel {rule} van de raamovereenkomst: "{exact Dutch contract quote}". Gefactureerd: {billedEur.nl} excl. btw; volgens de overeenkomst: {expectedEur.nl} excl. btw. Betwist bedrag: {disputeInclVatEur.nl} incl. btw.

Gefactureerd totaal: {billedTotalEur.nl} incl. btw; juist totaal volgens de overeenkomst: {correctedTotalEur.nl} incl. btw.

Totaal betwist: {disputeTotalEur.nl} incl. btw. Wij verzoeken u hiervoor een creditfactuur te sturen die verwijst naar factuur {invoiceNo} (artikel 4.8). Het onbetwiste deel van {correctedTotalEur.nl} wordt volgens artikel 4.10 binnen 30 dagen na ontvangst betaald.

Met vriendelijke groet,

Sanne Verbeek
Crediteurenadministratie, Woonkring Oostervelde
```

## Variants

- **Whole-invoice finding** (`lineNo: null`): start the bullet with "Factuur als geheel:" instead of
  `Regel {lineNo}, "{lineDescription}":`.
- **Indexation finding** (rule 4.2): the explanation names the work date from `executionDateNl`:
  "het werk is uitgevoerd op {executionDateNl}, dus geldt de prijs van 2025, maar er is een hogere prijs
  gefactureerd."
- **VAT-rate finding** (rule 4.6 dispute, "VAT charged at X% where Y% applies"): replace the whole bullet with

  ```text
  - Regel {lineNo}, "{lineDescription}": btw berekend tegen {billedRate}%; volgens de overeenkomst geldt {correctRate}% (schilderwerk aan een woning ouder dan twee jaar, bouwjaar {built}). Artikel 4.6 van de raamovereenkomst: "{exact Dutch contract quote}". Betwist bedrag: {disputeInclVatEur.nl} (te veel berekende btw).
  ```

  {billedRate} and {correctRate} are copied from the summary ("VAT charged at 21% where 9% applies"),
  {built} from the evidence line "<WO> built: <year>, …". No "Gefactureerd / volgens de overeenkomst"
  amounts in this bullet: billed and expected are VAT amounts here, not line amounts.
- **Arithmetic finding on a line** (`rule: "arithmetic"`, `lineNo` set): no article quote. Write
  `Regel {lineNo}, "{lineDescription}": de bedragen op de factuur tellen niet op: {Dutch explanation}.` and
  replace "volgens de overeenkomst" with "volgens de berekening" (amounts stay "excl. btw").
- **Arithmetic finding on the whole invoice** (`rule: "arithmetic"`, `lineNo: null`): billed and expected
  are invoice totals incl. VAT, so:

  ```text
  - Factuur als geheel: het factuurtotaal klopt niet: het is hoger dan subtotaal plus btw ({the evidence sum, e.g. "subtotaal € 339,01 + btw € 71,19 = € 410,20"}). Gefactureerd: {billedEur.nl} incl. btw; volgens de berekening: {expectedEur.nl} incl. btw. Betwist bedrag: {disputeInclVatEur.nl} incl. btw.
  ```

- **"Onbetwiste deel" sentence:** only when `correctedTotalCents` is above 0. Otherwise leave it out.
  Never subtract to get it.
- **Duplicate** (rule 4.8, full duplicate): after the opening line, replace everything up to
  "Met vriendelijke groet" with this one paragraph (no finding bullets, no totals):

  ```text
  Factuur {invoiceNo} van {invoiceDateNl} ({billedTotalEur.nl} incl. btw) is een dubbele factuur: hetzelfde werk voor werkorder {workOrder} is al gefactureerd met factuur {originalInvoiceNo} van {originalInvoiceDateNl}. Volgens artikel 4.8 van de raamovereenkomst wordt elke werkorder één keer gefactureerd. Wij betalen factuur {invoiceNo} daarom niet en verzoeken u deze te crediteren met een creditfactuur die verwijst naar factuur {invoiceNo}.
  ```

  `originalInvoiceNo` and `originalInvoiceDateNl` are fields on the 4.8 finding.
- **Hold:** no letter (see the review-list format).
