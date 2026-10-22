import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve data relative to this file, not process.cwd(), so the server works
// no matter which folder the MCP client launches it from.
const here = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = path.join(here, "..", "..", "data");
export const INVOICES_DIR = path.join(DATA_DIR, "invoices");
export const STATE_DIR = path.join(here, "..", "..", "state");
export const DECISIONS_FILE = path.join(STATE_DIR, "decisions.json");
