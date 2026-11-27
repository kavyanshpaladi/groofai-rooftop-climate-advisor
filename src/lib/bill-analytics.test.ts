import { describe, expect, it } from "vitest";
import { analyzeBill, billMonth, historyEntry, upsertHistory } from "./bill-analytics";
import type { BillResult } from "./bill";
import { DEFAULT_ASSUMPTIONS, subsidyFor } from "./impact";

const bill: BillResult = { units_kwh: 600, bill_amount_inr: 4800, billing_period_days: 60, billing_month: "November 2026", tariff_category: "domestic", sanctioned_load_kw: 3, cost_per_unit_inr: 8, confidence: "high", notes: null };
describe("Bill Analyzer estimates and privacy", () => {
  it("normalizes a 60-day bill and uses only the user's tariff", () => {
    expect(analyzeBill(bill, null)).toMatchObject({ monthlyUnits: 300, monthlyAmount: 2400, tariff: 8, dailyUnits: 10, yearlyAmount: 28800 });
  });
  it("uses the default irradiance and existing solar, subsidy and emission factors", () => {
    const result = analyzeBill(bill, null);
    if (!result) throw new Error("Expected estimates");
    expect(result.irradiance).toBe(5.5);
    expect(result.solar.kw).toBeCloseTo(3600 / (5.5 * 365 * 0.75));
    expect(result.solar.subsidy).toBeCloseTo(subsidyFor(result.solar.kw, DEFAULT_ASSUMPTIONS));
    expect(result.monthlySavings).toBeCloseTo(2400);
    expect(result.newMonthlyAmount).toBeCloseTo(0);
    expect(result.co2Kg).toBeCloseTo(3600 * 0.7);
    expect(result.payback).toBeCloseTo(result.solar.netCost / 28800);
  });
  it("uses the selected roof's sunlight and caps size by usable area", () => {
    const result = analyzeBill(bill, { usable: 10, irradiance: 4 });
    if (!result) throw new Error("Expected estimates");
    expect(result.irradiance).toBe(4);
    expect(result.solar.kw).toBeCloseTo(10 * 0.6 / 6.5);
    expect(result.newMonthlyAmount).toBeGreaterThan(0);
    expect(result.yearlySavings).toBeCloseTo(result.solar.kw * 4 * 365 * 0.75 * 8);
  });
  it("does not guess missing readings or billing days", () => {
    for (const key of ["units_kwh", "bill_amount_inr", "billing_period_days"] as const) expect(analyzeBill({ ...bill, [key]: null }, null)).toBeNull();
  });
  it("does not assume a residential subsidy for other tariff categories", () => {
    expect(analyzeBill({ ...bill, tariff_category: "commercial" }, null)?.solar.subsidy).toBe(0);
    expect(analyzeBill({ ...bill, tariff_category: "unknown" }, null)?.solar.subsidy).toBe(0);
  });
  it("keeps only month, units and amount, with no photo or personal text", () => {
    expect(historyEntry({ ...bill, notes: "Customer private details" })).toEqual({ month: "2026-11", units: 600, amount: 4800 });
    expect(historyEntry({ ...bill, billing_month: "Jane 12345" })).toBeNull();
    expect(billMonth("2026-13")).toBeNull();
  });
  it("keeps distinct months sorted and replaces repeated months", () => {
    const first = { month: "2026-11", units: 600, amount: 4800 };
    const second = { month: "2026-10", units: 300, amount: 2400 };
    expect(upsertHistory(upsertHistory([], first), second)).toEqual([second, first]);
    expect(upsertHistory([first], { ...first, units: 800 })).toEqual([{ ...first, units: 800 }]);
  });
});