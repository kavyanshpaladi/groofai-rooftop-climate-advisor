import { describe, expect, it } from "vitest";
import { roofStats, USABLE_FRACTION } from "./roof";
import { toGeoJSON } from "./overpass";

describe("roof", () => {
  it("usable area is 65% of roof area", () => {
    expect(USABLE_FRACTION).toBe(0.65);
    const fc = toGeoJSON([{ type: "way", id: 1, geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.001 }, { lat: 0.001, lon: 0.001 }, { lat: 0.001, lon: 0 }] }]);
    const s = roofStats(fc.features[0]!);
    expect(s.usable).toBeCloseTo(s.area * 0.65, 6);
    expect(s.area).toBeGreaterThan(12000);
  });
});
