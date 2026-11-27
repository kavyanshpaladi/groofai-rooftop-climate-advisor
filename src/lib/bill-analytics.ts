import { billTariff, monthlyBillValue, type BillResult } from "./bill";
import { CLIMATE_FALLBACK } from "./climate";
import { co2Avoided, DEFAULT_ASSUMPTIONS, solarForKw, solarImpact } from "./impact";

export type BillRoof = { usable: number; irradiance: number };

/** All projections use the same existing solar model and the bill's effective tariff. */
export function analyzeBill(bill: BillResult, roof: BillRoof | null) {
  const monthlyUnits = monthlyBillValue(bill.units_kwh, bill.billing_period_days);
  const monthlyAmount = monthlyBillValue(bill.bill_amount_inr, bill.billing_period_days);
  const tariff = billTariff(bill);
  if (monthlyUnits === null || monthlyAmount === null || tariff === null) return null;
  const irradiance = roof?.irradiance ?? CLIMATE_FALLBACK.irradiance;
  const assumptions = { ...DEFAULT_ASSUMPTIONS, monthlyKwh: monthlyUnits, tariff,
    ...(bill.tariff_category === "domestic" ? {} : { subsidyPerKw: 0, subsidyThirdKw: 0 }) };
  const demandKw = solarForKw(0, irradiance, assumptions).demandKw;
  const solar = roof ? solarImpact(roof.usable, irradiance, assumptions) : solarForKw(demandKw, irradiance, assumptions);
  const yearlySavings = Math.min(monthlyAmount * 12, Math.max(0, solar.savings));
  return { monthlyUnits, monthlyAmount, tariff, dailyUnits: monthlyUnits / 30, yearlyAmount: monthlyAmount * 12,
    irradiance, demandKw, solar, yearlySavings, monthlySavings: yearlySavings / 12,
    newMonthlyAmount: Math.max(0, monthlyAmount - yearlySavings / 12),
    payback: yearlySavings > 0 ? solar.netCost / yearlySavings : null,
    co2Kg: co2Avoided(Math.min(solar.kwhYear, monthlyUnits * 12), assumptions).kg };
}

export type BillHistoryEntry = { month: string; units: number; amount: number };
export const BILL_HISTORY_KEY = "groofai-bill-history";
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Only a canonical month is retained, never arbitrary text from an editable field. */
export function billMonth(raw: string | null): string | null {
  if (!raw) return null;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw;
  const match = /^([a-z]+)\s+(\d{4})$/i.exec(raw.trim());
  if (!match) return null;
  const index = MONTHS.indexOf((match[1] ?? "").toLowerCase());
  return index >= 0 ? `${match[2]}-${String(index + 1).padStart(2, "0")}` : null;
}

export function historyEntry(bill: BillResult): BillHistoryEntry | null {
  const month = billMonth(bill.billing_month);
  return month && bill.units_kwh !== null && bill.bill_amount_inr !== null
    ? { month, units: bill.units_kwh, amount: bill.bill_amount_inr } : null;
}

export function readBillHistory(): BillHistoryEntry[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(BILL_HISTORY_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((value: unknown) => {
      if (typeof value !== "object" || value === null) return [];
      const row = value as Record<string, unknown>;
      if (typeof row["month"] !== "string" || billMonth(row["month"]) !== row["month"] ||
        typeof row["units"] !== "number" || !Number.isFinite(row["units"]) || row["units"] < 0 ||
        typeof row["amount"] !== "number" || !Number.isFinite(row["amount"]) || row["amount"] < 0) return [];
      return [{ month: row["month"], units: row["units"], amount: row["amount"] }];
    });
  } catch { return []; }
}

export function upsertHistory(rows: BillHistoryEntry[], entry: BillHistoryEntry): BillHistoryEntry[] {
  return [...rows.filter((row) => row.month !== entry.month), entry].sort((a, b) => a.month.localeCompare(b.month));
}