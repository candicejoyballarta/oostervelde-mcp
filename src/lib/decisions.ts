import fs from "node:fs";
import path from "node:path";
import { DECISIONS_FILE } from "./paths.js";
import { listInvoiceFiles } from "../parsers/index.js";

export const VERDICTS = ["approve", "dispute", "hold"] as const;
export type Verdict = (typeof VERDICTS)[number];

export type Decision = {
  file: string;
  verdict: Verdict;
  reason: string;
  decidedBy: string;
  decidedAt: string; // ISO timestamp
};

/** Reads the decision log. Missing file → []. Anything but an array → throw, so it's never overwritten. */
function readLog(file: string): Decision[] {
  if (!fs.existsSync(file)) return [];
  const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${file} is not a JSON array; not touching it.`);
  return parsed as Decision[];
}

/** Appends one of Sanne's decisions. Earlier entries are kept as they are. */
export function recordDecision(
  input: { file: string; verdict: Verdict; reason: string; decidedBy?: string },
  logFile = DECISIONS_FILE,
): Decision {
  if (!listInvoiceFiles().includes(input.file)) {
    throw new Error(`Unknown invoice file "${input.file}". Call list_invoices to see the available file names.`);
  }
  if (!VERDICTS.includes(input.verdict)) throw new Error(`Unknown verdict "${input.verdict}".`);
  if (!input.reason.trim()) throw new Error("A reason is required.");

  const log = readLog(logFile);
  const decision: Decision = {
    file: input.file,
    verdict: input.verdict,
    reason: input.reason.trim(),
    decidedBy: input.decidedBy?.trim() || "Sanne",
    decidedAt: new Date().toISOString(),
  };

  // Write to a temp file and rename, so a crash never leaves a half-written log.
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const tmp = `${logFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify([...log, decision], null, 2));
  fs.renameSync(tmp, logFile);
  return decision;
}

/** The latest decision per invoice, with how many earlier ones it replaces. */
export function getDecisions(logFile = DECISIONS_FILE): (Decision & { earlierDecisions: number })[] {
  const byFile = new Map<string, Decision[]>();
  for (const d of readLog(logFile)) byFile.set(d.file, [...(byFile.get(d.file) ?? []), d]);
  return [...byFile.values()].map((list) => ({ ...list[list.length - 1], earlierDecisions: list.length - 1 }));
}
