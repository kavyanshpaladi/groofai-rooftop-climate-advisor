import { describe, expect, it } from "vitest";
import { scoreOptions, type Answers } from "./scoring";
import { solarImpact, DEFAULT_ASSUMPTIONS, rainwaterImpact } from "./impact";

const base: Answers = { roofType: "flat", shade: "none", access: "easy", priority: "bill", budget: "medium", bill: 3000 };
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
  it("solar kW = usable×0.6/6.5 and payback = cost/savings", () => {
    const s = solarImpact(65, 5, DEFAULT_ASSUMPTIONS);
    expect(s.kw).toBeCloseTo(6, 6);
    expect(s.kwhYear).toBeCloseTo(6 * 5 * 365 * 0.75, 4);
    expect(s.payback).toBeCloseTo((6 * 55000) / (s.kwhYear * 7), 6);
  });
  it("rainwater litres = usable×rainfall×0.8", () => {
    expect(rainwaterImpact(100, 800, DEFAULT_ASSUMPTIONS).litresYear).toBe(64000);
  });
});
