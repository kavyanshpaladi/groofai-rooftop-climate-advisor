import { describe, expect, it } from "vitest";
import { scoreOptions, type Answers } from "./scoring";
import { solarImpact, solarProjection, co2Avoided, familyWaterDays, heatRisk, DEFAULT_ASSUMPTIONS, rainwaterImpact } from "./impact";

const base: Answers = { roofType: "flat", shade: "none", access: "easy", priority: "bill", budget: "medium" };
const get = (r: ReturnType<typeof scoreOptions>, id: string) => r.find((o) => o.id === id)!.score;

describe("scoring", () => {
  it("reflective hot-summer boost starts at 37 °C", () => {
    const i = { usable: 50, irradiance: 5.5, rainfall: 800 };
    expect(get(scoreOptions(base, { ...i, maxTemp: 36.9 }), "reflective")).toBe(50);
    expect(get(scoreOptions(base, { ...i, maxTemp: 37 }), "reflective")).toBe(75);
  });
  it("solar: 50 +20 +10 +10 = 90", () => {
    expect(get(scoreOptions(base, { usable: 50, irradiance: 5.5, maxTemp: 30, rainfall: 800 }), "solar")).toBe(90);
  });
  it("hybrid is 0 below 40 m² usable", () => {
    expect(get(scoreOptions(base, { usable: 39, irradiance: 5.5, maxTemp: 33, rainfall: 800 }), "hybrid")).toBe(0);
  });
  it("hybrid = average of top two + 5", () => {
    const r = scoreOptions(base, { usable: 50, irradiance: 5.5, maxTemp: 33, rainfall: 800 });
    // solar 90, rainwater 80, reflective 50
    expect(get(r, "hybrid")).toBe(90);
  });
  it("reflective: hot + cooler + low budget = 100", () => {
    const r = scoreOptions({ ...base, priority: "cooler", budget: "low" }, { usable: 50, irradiance: 5.5, maxTemp: 38, rainfall: 800 });
    expect(get(r, "reflective")).toBe(100);
  });
});

describe("impact", () => {
  it("solar is sized to 300 kWh/month, capped by roof capacity", () => {
    const s = solarImpact(65, 5, DEFAULT_ASSUMPTIONS);
    expect(s.roofMaxKw).toBeCloseTo(6, 6);
    expect(s.kw).toBeCloseTo(3600 / (5 * 365 * 0.75), 6);
    expect(s.kwhYear).toBeCloseTo(3600, 4);
    expect(s.payback).toBeCloseTo(s.cost / (3600 * 7), 6);
    const small = solarImpact(13, 5, DEFAULT_ASSUMPTIONS);
    expect(small.kw).toBeCloseTo(1.2, 6);
  });
  it("subsidy defaults to 0 and lowers payback cost", () => {
    expect(DEFAULT_ASSUMPTIONS.subsidy).toBe(0);
    const s = solarImpact(65, 5, { ...DEFAULT_ASSUMPTIONS, subsidy: 30000 });
    expect(s.netCost).toBeCloseTo(s.cost - 30000, 6);
  });
  it("25-year projection: 3% tariff rise, 0.5% degradation, 1% maintenance", () => {
    const p = solarProjection(1000, 10000, DEFAULT_ASSUMPTIONS);
    expect(p.rows).toHaveLength(25);
    expect(p.rows[0]!.savings).toBeCloseTo(1000 * 7 - 100, 6);
    expect(p.rows[1]!.kwh).toBeCloseTo(995, 6);
    expect(p.rows[1]!.savings).toBeCloseTo(995 * 7.21 - 100, 6);
    expect(p.rows[0]!.cumulativeNet).toBeCloseTo(-10000 + 6900, 6);
    expect(p.breakEvenYear).toBe(2);
  });
  it("CO2 = kWh × 0.7, trees = CO2 / 21", () => {
    const c = co2Avoided(3000, DEFAULT_ASSUMPTIONS);
    expect(c.kg).toBeCloseTo(2100, 6);
    expect(c.trees).toBeCloseTo(100, 6);
  });
  it("family of 4 uses 540 litres/day", () => {
    expect(familyWaterDays(54000, DEFAULT_ASSUMPTIONS)).toBe(100);
  });
  it("heat risk thresholds 30 / 35 / 40 °C", () => {
    expect(heatRisk(29.9, DEFAULT_ASSUMPTIONS)).toBe("Low");
    expect(heatRisk(30, DEFAULT_ASSUMPTIONS)).toBe("Moderate");
    expect(heatRisk(35, DEFAULT_ASSUMPTIONS)).toBe("High");
    expect(heatRisk(40, DEFAULT_ASSUMPTIONS)).toBe("High");
    expect(heatRisk(40.1, DEFAULT_ASSUMPTIONS)).toBe("Extreme");
  });
  it("rainwater litres = usable×rainfall×0.8", () => {
    expect(rainwaterImpact(100, 800, DEFAULT_ASSUMPTIONS).litresYear).toBe(64000);
  });
});
