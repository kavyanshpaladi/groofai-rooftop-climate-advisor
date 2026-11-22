import { describe, expect, it } from "vitest";
import { computeStats, type ReportRow } from "./stats";

const row = (p: Partial<ReportRow>): ReportRow => ({ id: "x", created_at: "2026-11-22T10:00:00Z", latitude: 17.385, longitude: 78.487, roof_area: 100, usable_area: 80, answers: {}, best_option: "solar", estimates: null, ...p });

describe("computeStats", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  it("counts today and last 7 days", () => {
    const s = computeStats([row({}), row({ created_at: "2026-11-18T10:00:00Z" }), row({ created_at: "2026-11-01T10:00:00Z" })], now);
    expect(s.total).toBe(3);
    expect(s.week).toBe(2);
  });
  it("sums solar kWh only where available", () => {
    const s = computeStats([row({ estimates: { solarKwhYear: 1000 } }), row({ estimates: null })], now);
    expect(s.kwh).toBe(1000);
  });
  it("counts best options", () => {
    const s = computeStats([row({ best_option: "green" }), row({ best_option: "green" })], now);
    expect(s.counts["green"]).toBe(2);
  });
});
