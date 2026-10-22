import { readCsv } from "./csv.js";
import { parseDotDecimalCents } from "./money.js";
import type { Supplier } from "../types.js";

export type WorkOrder = {
  wo: string;
  address: string;
  supplier: Supplier;
  job: string;
  type: "spoed" | "regulier"; // emergency / regular (contract 4.3)
  maxLaborHours: number; // contract 4.4
  extraHoursApproval: { id: string; hours: number } | null; // MU-xxxx (4.4)
  meerwerkApproval: { id: string; amountCents: number } | null; // GA-xxxx (4.5)
  built: number; // build year (4.6)
};

export type WorkOrderLookup =
  | ({ found: true } & WorkOrder)
  | { found: false; wo: string; note: string };

let cache: WorkOrder[] | null = null;

export function loadWorkOrders(): WorkOrder[] {
  if (cache) return cache;

  cache = readCsv("work-orders-export.csv").map((row) => ({
    wo: row.wo,
    address: row.address,
    supplier: row.supplier as Supplier,
    job: row.job,
    type: row.type as WorkOrder["type"],
    maxLaborHours: Number(row.max_labor_hours),
    // An empty approval id means there is no approval.
    extraHoursApproval: row.extra_hours_approval
      ? { id: row.extra_hours_approval, hours: Number(row.approved_extra_hours) }
      : null,
    meerwerkApproval: row.meerwerk_approval
      ? { id: row.meerwerk_approval, amountCents: parseDotDecimalCents(row.approved_meerwerk_eur) }
      : null,
    built: Number(row.built),
  }));
  return cache;
}

/** Looks up a work order like "WO-26-1001". Unknown is a normal answer, not an error. */
export function getWorkOrder(wo: string): WorkOrderLookup {
  const wanted = wo.trim().toUpperCase();
  const found = loadWorkOrders().find((order) => order.wo === wanted);
  if (found) return { found: true, ...found };
  return {
    found: false,
    wo: wanted,
    note: "Unknown work order. Contract 4.9: not paid until the job is confirmed.",
  };
}
