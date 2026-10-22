import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths.js";
import { CONTRACT_TRANSLATIONS } from "./contractTranslations.js";

export type ContractRule = {
  article: string; // "4.5"
  title: string; // "Meerwerk (Extra work)"
  dutch: string; // exact text from contract-excerpt.md
  english: string; // translation from contractTranslations.ts
};

let cache: ContractRule[] | null = null;

// Each article is one paragraph: "**4.5 Meerwerk.** Werk buiten de werkorder ..."
const ARTICLE = /^\*\*(4\.\d+) (.+?)\.\*\* (.+)$/;

export function loadContract(): ContractRule[] {
  if (cache) return cache;

  const text = fs.readFileSync(path.join(DATA_DIR, "contract-excerpt.md"), "utf8");
  cache = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(ARTICLE);
    if (!match) continue;
    const [, article, dutchTitle, dutch] = match;
    const translation = CONTRACT_TRANSLATIONS[article];
    cache.push({
      article,
      title: translation ? `${dutchTitle} (${translation.title})` : dutchTitle,
      dutch: dutch.trim(),
      english: translation ? translation.english : "(no translation yet)",
    });
  }
  return cache;
}

/** One Article 4 rule by number ("4.1" to "4.10"). Throws for an unknown article. */
export function getContractRule(article: string): ContractRule {
  const rules = loadContract();
  const rule = rules.find((r) => r.article === article.trim());
  if (!rule) {
    const known = rules.map((r) => r.article).join(", ");
    throw new Error(`Unknown article "${article}". Available: ${known}.`);
  }
  return rule;
}
