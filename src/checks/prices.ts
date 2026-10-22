import { formatCents, roundDiv } from "../lib/money.js";
import { getPrice } from "../lib/prices.js";
import type { CheckContext, RuleFinding } from "./types.js";

/**
 * 4.1/4.2: each priced line may not cost more than the contract price that
 * applies on the execution date. The price-list unit is decisive: a line
 * billed per "m" for an item priced per "rol 25 m" is compared against the
 * exact per-metre price (price ÷ 25, not rounded first); only the final line
 * amount is rounded to cents.
 */
export function checkPrices({ invoice, claimed }: CheckContext): RuleFinding[] {
  if (invoice.isCreditNote) return [];

  const findings: RuleFinding[] = [];
  for (const line of invoice.lines) {
    if (!line.code || claimed.has(line.lineNo)) continue;

    const price = getPrice(line.code, invoice.executionDate);
    const billed = line.quantity * line.unitPriceCents;
    const billedText = `Billed: ${line.quantity} ${line.unit} × ${formatCents(line.unitPriceCents)} = ${formatCents(billed)}`;

    let correct: number;
    let correctText: string;
    let rule = price.priceYear === 2025 ? "4.2" : "4.1";

    const roll = price.unit.match(/^rol (\d+) m$/);
    if (line.unit === price.unit) {
      correct = line.quantity * price.appliesCents;
      correctText = `Contract: ${line.quantity} ${line.unit} × ${formatCents(price.appliesCents)} = ${formatCents(correct)}`;
    } else if (roll && line.unit === "m") {
      const metresPerRoll = Number(roll[1]);
      correct = roundDiv(line.quantity * price.appliesCents, metresPerRoll);
      rule = "4.1";
      correctText =
        `Contract: ${formatCents(price.appliesCents)} per ${price.unit} → ${line.quantity} m × ` +
        `${formatCents(price.appliesCents)} ÷ ${metresPerRoll} = ${formatCents(correct)} (exact per-metre price, rounded once)`;
    } else {
      findings.push({
        rule: "4.1",
        kind: "hold",
        lineNo: line.lineNo,
        summary: `Line is billed per "${line.unit}" but ${line.code} is priced per "${price.unit}", and there is no known conversion.`,
        billedCents: billed,
        expectedCents: 0,
        evidence: [billedText, `Price list: ${line.code} ${price.description}, ${formatCents(price.appliesCents)} per ${price.unit}`],
      });
      continue;
    }

    if (billed <= correct) continue;
    findings.push({
      rule,
      kind: "dispute",
      lineNo: line.lineNo,
      summary:
        rule === "4.2"
          ? `Work was done on ${invoice.executionDate}, so the 2025 price applies, but a higher price was billed.`
          : `"${line.description}" is billed above the contract price for ${line.code}.`,
      billedCents: billed,
      expectedCents: correct,
      evidence: [billedText, correctText, `Price: ${price.calculation}`],
      effect: { type: "reduceLine", cents: billed - correct },
    });
  }
  return findings;
}
