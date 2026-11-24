import { describe, expect, it } from "vitest";
import { scoreOptions, type Answers } from "./scoring";
import { PANEL_KW, loanEmi, subsidyFor, solarForKw, stepPanels, recommendSolar, solarImpact, solarProjection, co2Avoided, familyWaterDays, heatRisk, DEFAULT_ASSUMPTIONS, rainwaterImpact } from "./impact";

const base: Answers = { roofType: "flat", shade: "none", access: "easy", priority: "bill", budget: "unsure" };
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
  it("low budget lowers solar by 15", () => {
    const i = { usable: 50, irradiance: 5.5, maxTemp: 30, rainfall: 800 };
    expect(get(scoreOptions({ ...base, budget: "low" }, i), "solar")).toBe(75);
  });
});

describe("recommended solar size", () => {
  // irradiance 5 → need = 3600 / (5 × 365 × 0.75) ≈ 2.63 kW; cost ₹55,000/kW
  it("Not sure or no answer = a typical home's need, in whole 400 W panels", () => {
    for (const b of ["unsure", undefined] as const) {
      const r = recommendSolar(20, 5, b, DEFAULT_ASSUMPTIONS);
      expect(r.panels).toBe(6);
      expect(r.kw).toBeCloseTo(2.4, 6);
      expect(r.limitedBy).toBe("need");
    }
  });
  it("low budget (₹50k) buys 2 panels", () => {
    const r = recommendSolar(20, 5, "low", DEFAULT_ASSUMPTIONS);
    expect(r.panels).toBe(2);
    expect(r.limitedBy).toBe("budget");
  });
  it("medium budget (₹1.5L) buys 6 panels", () => {
    const r = recommendSolar(20, 5, "medium", DEFAULT_ASSUMPTIONS);
    expect(r.budgetKw).toBeCloseTo(150000 / 55000, 6);
    expect(r.panels).toBe(6);
  });
  it("high budget (₹5L) buys 22 panels and is not capped at the typical home need", () => {
    const r = recommendSolar(20, 5, "high", DEFAULT_ASSUMPTIONS);
    expect(r.budgetKw).toBeCloseTo(500000 / 55000, 6);
    expect(r.panels).toBe(22);
    expect(r.kw).toBeGreaterThan(r.needKw);
  });
  it("is capped at the most panels the roof fits", () => {
    const r = recommendSolar(1.6, 5, "high", DEFAULT_ASSUMPTIONS);
    expect(r.panels).toBe(4);
    expect(r.limitedBy).toBe("roof");
  });
  it("is at least 1 panel when the roof fits one", () => {
    expect(recommendSolar(20, 5, "low", { ...DEFAULT_ASSUMPTIONS, costPerKw: 200000 }).panels).toBe(1);
    expect(recommendSolar(0.3, 5, "unsure", DEFAULT_ASSUMPTIONS).panels).toBe(0);
  });
});

describe("impact", () => {
  it("solar is sized to 300 kWh/month, capped by roof capacity", () => {
    const s = solarImpact(65, 5, DEFAULT_ASSUMPTIONS);
    expect(s.roofMaxKw).toBeCloseTo(6, 6);
    expect(s.kw).toBeCloseTo(3600 / (5 * 365 * 0.75), 6);
    expect(s.kwhYear).toBeCloseTo(3600, 4);
    expect(s.payback).toBeCloseTo(s.netCost / (3600 * 7), 6);
    const small = solarImpact(13, 5, DEFAULT_ASSUMPTIONS);
    expect(small.kw).toBeCloseTo(1.2, 6);
  });
  it("subsidy: Rs 30,000 per kW for the first 2 kW, Rs 18,000 for the third, Rs 78,000 from 3 kW", () => {
    expect(subsidyFor(1, DEFAULT_ASSUMPTIONS)).toBeCloseTo(30000, 6);
    expect(subsidyFor(2, DEFAULT_ASSUMPTIONS)).toBeCloseTo(60000, 6);
    expect(subsidyFor(3, DEFAULT_ASSUMPTIONS)).toBeCloseTo(78000, 6);
    expect(subsidyFor(8, DEFAULT_ASSUMPTIONS)).toBeCloseTo(78000, 6);
  });
  it("at 3 kW you pay the cost minus the Rs 78,000 subsidy, and payback uses what you pay", () => {
    const s = solarForKw(3, 5, DEFAULT_ASSUMPTIONS);
    expect(s.cost).toBeCloseTo(165000, 6);
    expect(s.netCost).toBeCloseTo(87000, 6);
    expect(s.payback).toBeCloseTo(87000 / s.savings, 6);
  });
  it("loan EMI: cost before subsidy at 7% over 10 years", () => {
    expect(DEFAULT_ASSUMPTIONS.loanInterestPct).toBe(7);
    expect(DEFAULT_ASSUMPTIONS.loanYears).toBe(10);
    expect(loanEmi(165000, 7, 10)).toBeCloseTo(1915.79, 1);
    expect(loanEmi(120000, 0, 10)).toBeCloseTo(1000, 6);
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

describe("cost stepper", () => {
  it("one step changes the cost by one panel's worth", () => {
    const cost = (n: number) => solarForKw(n * PANEL_KW, 5, DEFAULT_ASSUMPTIONS).cost;
    expect(cost(stepPanels(6, 1, 20)) - cost(6)).toBeCloseTo(cost(1), 6);
    expect(cost(6) - cost(stepPanels(6, -1, 20))).toBeCloseTo(cost(1), 6);
  });
  it("lowest is one panel", () => {
    expect(stepPanels(1, -1, 20)).toBe(1);
  });
  it("highest is the most panels the roof fits", () => {
    expect(stepPanels(20, 1, 20)).toBe(20);
  });
});
