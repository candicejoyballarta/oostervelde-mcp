import { formatCents, roundDiv } from "../lib/money.js";
import { REDUCED_VAT_CODES, type CheckContext, type RuleFinding } from "./types.js";

/** VAT per rate over the whole invoice, half-up (how all four suppliers round). */
export function vatFor(lines: { amountCents: number; rate: number }[]): number {
  const bases = new Map<number, number>();
  for (const line of lines) bases.set(line.rate, (bases.get(line.rate) ?? 0) + line.amountCents);
  let vat = 0;
  for (const [rate, base] of bases) vat += roundDiv(base * rate, 100);
  return vat;
}

/**
 * 4.6: 9% only on painter labour (W01, W04) for homes older than two years;
 * everything else 21%. Too much VAT → dispute per line. Too little VAT → one
 * hold finding with the shortfall (a corrected invoice is needed; it is not
 * part of the dispute). Exactly two years → hold, because the build year alone
 * can't tell whether the home is older than two years.
 */
export function checkVat({ invoice, workOrder }: CheckContext): RuleFinding[] {
  if (!workOrder || invoice.isCreditNote) return [];

  const age = Number(invoice.executionDate.slice(0, 4)) - workOrder.built;
  const facts = [`${workOrder.wo} built: ${workOrder.built}, work done ${invoice.executionDate} → ${age} years`];
  const findings: RuleFinding[] = [];
  const underBilled: { lineNo: number; billedRate: number; expectedRate: number }[] = [];

  for (const line of invoice.lines) {
    if (line.vatRate === null) continue;
    const reducedCode = line.code !== null && REDUCED_VAT_CODES.includes(line.code);

    if (reducedCode && age === 2) {
      findings.push({
        rule: "4.6",
        kind: "hold",
        lineNo: line.lineNo,
        summary: `Can't determine 'older than two years' from build year alone (built ${workOrder.built}, work done ${invoice.executionDate}).`,
        billedCents: line.amountCents,
        expectedCents: line.amountCents,
        evidence: [...facts, `Line ${line.lineNo}: ${line.code} at ${line.vatRate}%`],
      });
      continue;
    }

    const expectedRate = reducedCode && age > 2 ? 9 : 21;
    const why = reducedCode
      ? age > 2
        ? `${line.code} is painter labour on a home older than two years → 9%`
        : `${line.code} is painter labour, but the home is not older than two years → 21%`
      : `${line.code ?? "This line"} is not painter labour (only W01/W04 qualify) → 21%`;

    if (line.vatRate > expectedRate) {
      const billedVat = roundDiv(line.amountCents * line.vatRate, 100);
      const expectedVat = roundDiv(line.amountCents * expectedRate, 100);
      findings.push({
        rule: "4.6",
        kind: "dispute",
        lineNo: line.lineNo,
        summary: `VAT charged at ${line.vatRate}% where ${expectedRate}% applies.`,
        billedCents: billedVat,
        expectedCents: expectedVat,
        evidence: [
          ...facts,
          why,
          `${formatCents(line.amountCents)} × (${line.vatRate}% − ${expectedRate}%) = ${formatCents(roundDiv(line.amountCents * (line.vatRate - expectedRate), 100))} VAT too much`,
        ],
        effect: { type: "lowerVatRate", rate: expectedRate },
      });
    } else if (line.vatRate < expectedRate) {
      underBilled.push({ lineNo: line.lineNo, billedRate: line.vatRate, expectedRate });
    }
  }

  if (underBilled.length > 0) {
    const asBilled = invoice.lines.map((l) => ({ amountCents: l.amountCents, rate: l.vatRate ?? 21 }));
    const asExpected = invoice.lines.map((l) => {
      const under = underBilled.find((u) => u.lineNo === l.lineNo);
      return { amountCents: l.amountCents, rate: under ? under.expectedRate : (l.vatRate ?? 21) };
    });
    const billedVat = vatFor(asBilled);
    const expectedVat = vatFor(asExpected);
    findings.push({
      rule: "4.6",
      kind: "hold",
      lineNo: null,
      summary: `VAT is ${formatCents(expectedVat - billedVat)} too low; a corrected invoice is needed (not part of the dispute).`,
      billedCents: billedVat,
      expectedCents: expectedVat,
      evidence: [
        ...facts,
        ...underBilled.map((u) => `Line ${u.lineNo}: ${u.billedRate}% billed, ${u.expectedRate}% applies`),
        `VAT as billed ${formatCents(billedVat)}, VAT as it should be ${formatCents(expectedVat)}: shortfall ${formatCents(expectedVat - billedVat)}`,
      ],
    });
  }
  return findings;
}
