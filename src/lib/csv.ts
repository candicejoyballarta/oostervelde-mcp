import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths.js";

// Splits one CSV line, keeping commas inside "quoted fields" together.
// (Enough for our files; it doesn't handle escaped quotes.)
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else current += ch;
  }
  fields.push(current);
  return fields;
}

/** Reads a CSV file from data/ into one object per row, keyed by the header names. */
export function readCsv(fileName: string): Record<string, string>[] {
  const text = fs.readFileSync(path.join(DATA_DIR, fileName), "utf8");
  const [header, ...rows] = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const names = splitCsvLine(header);

  return rows.map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(names.map((name, i) => [name, (values[i] ?? "").trim()]));
  });
}
