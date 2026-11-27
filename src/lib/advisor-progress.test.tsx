import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdvisorProgressProvider, useAdvisorProgress, type AdvisorDraft } from "./advisor-progress";
import type { BillResult } from "./bill";

const draft: AdvisorDraft = { photo: { mimeType: "image/jpeg", data: "AAAA", url: "data:image/jpeg;base64,AAAA" },
  needs: { billUnit: "inr", monthlyBill: 2000, people: 6, appliances: ["ac"], daytimeSharePct: 70, budget: "high", notes: "Keep my answers" }, step: 1, bill: null };
const bill: BillResult = { units_kwh: 600, bill_amount_inr: 4800, billing_period_days: 60, billing_month: "2026-11", tariff_category: "domestic", sanctioned_load_kw: 3, cost_per_unit_inr: 8, confidence: "high", notes: null };
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

function mountProgress() {
  let current: ReturnType<typeof useAdvisorProgress> | null = null;
  function Consumer() { current = useAdvisorProgress(); return null; }
  const rendered = render(<AdvisorProgressProvider><Consumer /></AdvisorProgressProvider>);
  const get = () => { if (!current) throw new Error("Not mounted"); return current; };
  return { ...rendered, get };
}
describe("Advisor progress round trip", () => {
  it("restores the roof photo, every answer and current step from session storage", () => {
    const first = mountProgress();
    act(() => first.get().save(draft));
    first.unmount();
    const second = mountProgress();
    expect(second.get().load()).toEqual(draft);
  });
  it("keeps large photos in shared memory when session storage is full", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    const mounted = mountProgress();
    act(() => mounted.get().save(draft));
    expect(mounted.get().load()).toEqual(draft);
    act(() => mounted.get().transfer(bill));
    expect(mounted.get().takeBill()).toEqual(bill);
  });
  it("transfers bill readings only once without replacing the saved roof photo or answers", () => {
    const mounted = mountProgress();
    act(() => { mounted.get().save(draft); mounted.get().transfer(bill); });
    expect(mounted.get().takeBill()).toEqual(bill);
    expect(mounted.get().takeBill()).toBeNull();
    expect(mounted.get().load()).toEqual({ ...draft, needs: { ...draft.needs, billUnit: "kwh", monthlyBill: 300 }, bill, step: 1 });
    expect(mounted.get().revision).toBe(1);
  });
});