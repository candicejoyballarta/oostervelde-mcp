import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import { INVOICES_DIR } from "./lib/paths.js";
import { listInvoiceFiles, parseInvoice } from "./parsers/index.js";
import { getPrice } from "./lib/prices.js";
import { getWorkOrder } from "./lib/workOrders.js";
import { getContractRule } from "./lib/contract.js";
import { findDuplicates } from "./lib/duplicates.js";
import { checkInvoice } from "./checks/index.js";

// Runs a lookup and returns its result as pretty JSON, or a thrown error as isError.
function jsonResult(lookup: () => unknown) {
  try {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(lookup(), null, 2) }],
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        { type: "text" as const, text: error instanceof Error ? error.message : String(error) },
      ],
    };
  }
}

const SUPPLIERS: Record<string, string> = {
  h: "Hoekstra",
  w: "De Wit",
  b: "Bosman",
  j: "Jansen",
};

const server = new McpServer({ name: "oostervelde", version: "0.1.0" });

server.registerTool(
  "ping",
  {
    description: "Say hello. Used only to test the server is wired up.",
    inputSchema: { name: z.string().describe("Who to greet") },
  },
  async ({ name }) => ({
    content: [
      {
        type: "text",
        text: `Hello ${name}, the Oostervelde server is running.`,
      },
    ],
  }),
);

server.registerTool(
  "list_invoices",
  {
    description: "List of all invoices",
    inputSchema: {},
  },
  async () => {
    const list = fs
      .readdirSync(INVOICES_DIR)
      .filter((f) => f.endsWith(".txt"))
      .map((file) => ({
        file,
        supplier: SUPPLIERS[file[0]] ?? "Unknown",
      }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(list, null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "get_invoice",
  {
    description:
      "Get one invoice as JSON: header, lines, VAT and totals. " +
      "Money is in integer cents (252840 = EUR 2.528,40). " +
      "`warnings` lists amounts that don't add up.",
    inputSchema: {
      file: z
        .string()
        .describe("Invoice file name from list_invoices, e.g. 'h-2026-0031.txt'"),
    },
  },
  async ({ file }) => {
    // Only accept names that list_invoices would return (also blocks "../" paths).
    if (!listInvoiceFiles().includes(file)) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unknown invoice file "${file}". Call list_invoices to see the available file names.`,
          },
        ],
      };
    }

    try {
      const invoice = parseInvoice(file);
      return {
        content: [{ type: "text", text: JSON.stringify(invoice, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Could not parse "${file}": ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "get_price",
  {
    description:
      "Contract price for a price-list code. The execution date picks the 2025 or the indexed 2026 price " +
      "(contract 4.2), not the invoice date. Prices are integer cents excl. VAT.",
    inputSchema: {
      code: z.string().describe("Price-list code, e.g. 'H02' (the `code` of an invoice line)"),
      executionDate: z
        .string()
        .describe("Date the work was done, ISO yyyy-mm-dd (the invoice's executionDate)"),
    },
  },
  async ({ code, executionDate }) => jsonResult(() => getPrice(code, executionDate)),
);

server.registerTool(
  "get_work_order",
  {
    description:
      "Look up a work order: type (spoed/regulier), max labour hours, approved extra hours (MU) " +
      "and meerwerk (GA, integer cents), build year. found: false means it doesn't exist (contract 4.9).",
    inputSchema: {
      wo: z.string().describe("Work order number, e.g. 'WO-26-1001'"),
    },
  },
  async ({ wo }) => jsonResult(() => getWorkOrder(wo)),
);

server.registerTool(
  "get_contract_rule",
  {
    description:
      "One article of contract Article 4: the exact Dutch text plus an English translation. " +
      "The Dutch text is the contract; quote it when disputing.",
    inputSchema: {
      article: z.string().describe("Article number, '4.1' to '4.10'"),
    },
  },
  async ({ article }) => jsonResult(() => getContractRule(article)),
);

server.registerTool(
  "find_duplicates",
  {
    description:
      "Find work orders billed on more than one invoice (contract 4.8). Credit notes that correct " +
      "an invoice in the group are left out. Totals are integer cents.",
    inputSchema: {},
  },
  async () => jsonResult(() => ({ groups: findDuplicates() })),
);

server.registerTool(
  "check_invoice",
  {
    description:
      "Check one invoice against contract Article 4. Returns findings (dispute / hold / info) with evidence, " +
      "and billed vs corrected totals. Amounts are integer cents; disputeTotalCents is incl. VAT. " +
      "It does not decide the verdict.",
    inputSchema: {
      file: z
        .string()
        .describe("Invoice file name from list_invoices, e.g. 'b-B-26-0102.txt'"),
    },
  },
  async ({ file }) =>
    jsonResult(() => {
      // Only accept names that list_invoices would return (also blocks "../" paths).
      if (!listInvoiceFiles().includes(file)) {
        throw new Error(`Unknown invoice file "${file}". Call list_invoices to see the available file names.`);
      }
      return checkInvoice(file);
    }),
);

await server.connect(new StdioServerTransport());
console.error("oostervelde MCP server running on stdio");
