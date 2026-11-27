import { z } from "zod";
import { advisorRequestSchema, type AdvisorNeeds } from "./advisor";

export const BILL_CATEGORIES = ["domestic", "commercial", "industrial", "agricultural", "unknown"] as const;
const number = z.number().finite().nonnegative().nullable();
export const billResultSchema = z.object({
  units_kwh: number,
  bill_amount_inr: number,
  billing_period_days: z.number().finite().positive().nullable(),
  billing_month: z.string().max(60).nullable(),
  tariff_category: z.enum(BILL_CATEGORIES).nullable(),
  sanctioned_load_kw: number,
  cost_per_unit_inr: number,
  confidence: z.enum(["low", "medium", "high"]).nullable(),
  notes: z.string().max(500).nullable(),
});
export const billRequestSchema = advisorRequestSchema.pick({ image: true, language: true }).strict();
export type BillResult = z.infer<typeof billResultSchema>;
export type BillRequest = z.infer<typeof billRequestSchema>;

export function billTariff(bill: Pick<BillResult, "units_kwh" | "bill_amount_inr">): number | null {
  return bill.units_kwh !== null && bill.units_kwh > 0 && bill.bill_amount_inr !== null
    ? bill.bill_amount_inr / bill.units_kwh : null;
}

/** Never assume a missing billing period is one month. */
export function monthlyBillValue(value: number | null, days: number | null): number | null {
  return value !== null && days !== null && days > 0 ? Math.round(value * 30 / days * 100) / 100 : null;
}

export function fillNeedsFromBill(needs: AdvisorNeeds, bill: BillResult): AdvisorNeeds {
  const units = monthlyBillValue(bill.units_kwh, bill.billing_period_days);
  const amount = monthlyBillValue(bill.bill_amount_inr, bill.billing_period_days);
  if (units !== null) return { ...needs, billUnit: "kwh", monthlyBill: units };
  if (amount !== null) return { ...needs, billUnit: "inr", monthlyBill: amount };
  return needs;
}