import { describe, expect, it, vi, afterEach } from "vitest";
import { billRequestSchema, billResultSchema, billTariff, fillNeedsFromBill, monthlyBillValue, type BillResult } from "./bill";
import { advisorRequestSchema, type AdvisorNeeds } from "./advisor";
import { checkRateLimit, runBillScan, runAdvisor } from "./advisor.server";

const needs: AdvisorNeeds = { billUnit: "inr", monthlyBill: 2000, people: 4, appliances: [], daytimeSharePct: 50, budget: "medium", notes: "" };
const bill: BillResult = { units_kwh: 600, bill_amount_inr: 4800, billing_period_days: 60, billing_month: "November 2026", tariff_category: "domestic", sanctioned_load_kw: 3, cost_per_unit_inr: 8, confidence: "high", notes: null };
const request = { image: { mimeType: "image/png" as const, data: "AAAA" }, language: "en" as const };
afterEach(() => vi.unstubAllGlobals());
describe("bill rules", () => {
  it("validates only jpg/png/webp images up to 8 MB", () => {
    for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) expect(billRequestSchema.safeParse({ ...request, image: { mimeType, data: "AAAA" } }).success).toBe(true);
    expect(billRequestSchema.safeParse({ ...request, image: { mimeType: "image/gif", data: "AAAA" } }).success).toBe(false);
    expect(billRequestSchema.safeParse({ ...request, image: { mimeType: "image/png", data: "A".repeat(Math.ceil((8 * 1024 * 1024 + 3) * 4 / 3)) } }).success).toBe(false);
  });
  it("accepts all nullable extraction fields", () => {
    expect(billResultSchema.safeParse(Object.fromEntries(Object.keys(bill).map((key) => [key, null]))).success).toBe(true);
  });
  it("normalizes a 60-day bill to 30 days before filling monthly units", () => {
    expect(monthlyBillValue(600, 60)).toBe(300);
    expect(fillNeedsFromBill(needs, bill)).toMatchObject({ billUnit: "kwh", monthlyBill: 300 });
  });
  it("normalizes amount when only the amount is readable", () => {
    expect(fillNeedsFromBill(needs, { ...bill, units_kwh: null })).toMatchObject({ billUnit: "inr", monthlyBill: 2400 });
  });
  it("does not guess a missing period or overwrite manual data", () => {
    expect(fillNeedsFromBill(needs, { ...bill, billing_period_days: null })).toBe(needs);
    expect(monthlyBillValue(null, 30)).toBeNull();
  });
  it("computes tariff only from amount and positive units", () => {
    expect(billTariff(bill)).toBe(8);
    expect(billTariff({ ...bill, bill_amount_inr: null })).toBeNull();
    expect(billTariff({ ...bill, units_kwh: null })).toBeNull();
    expect(billTariff({ ...bill, units_kwh: 0 })).toBeNull();
  });
  it("shares the advisor five-request IP limit", () => {
    for (let i = 0; i < 5; i++) expect(checkRateLimit("bill-rule-test")).toBe(true);
    expect(checkRateLimit("bill-rule-test")).toBe(false);
  });
  it("never returns identifiers or untrusted free-form notes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ...bill, billing_month: "Customer Jane 12345", notes: "Jane phone 12345", consumer_number: "12345", cost_per_unit_inr: 99 }) }] } }] })));
    const out = await runBillScan(request, "test-key");
    expect(out).toEqual({ result: { ...bill, billing_month: null, notes: null } });
  });
  it("returns a safe quota failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private quota error", { status: 429 })));
    expect(await runBillScan(request, "test-key")).toEqual({ error: "busy" });
  });
  it("returns friendly unavailable for invalid structured responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ candidates: [] })));
    expect(await runBillScan(request, "test-key")).toEqual({ error: "unavailable" });
  });
  it("passes real tariff, units, amount and sanctioned load to advice without bill identifiers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("busy", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const data = advisorRequestSchema.parse({ ...request, needs, bill: { units_kwh: 600, bill_amount_inr: 4800, billing_period_days: 60, cost_per_unit_inr: 99, sanctioned_load_kw: 3, tariff_category: "domestic" } });
    await runAdvisor(data, "test-key");
    const rawBody = fetchMock.mock.calls[0]?.[1]?.body;
    const body = JSON.parse(typeof rawBody === "string" ? rawBody : "{}");
    const text = body.contents[0].parts[1].text;
    expect(text).toContain('"cost_per_unit_inr":8');
    expect(text).toContain('"sanctioned_load_kw":3');
    expect(text).toContain('"units_kwh":600');
    expect(text).toContain('"bill_amount_inr":4800');
    expect(data.bill).not.toHaveProperty("notes");
  });
});