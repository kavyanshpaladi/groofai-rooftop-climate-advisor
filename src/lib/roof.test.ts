import { describe, expect, it } from "vitest";
import type { Feature, Polygon } from "geojson";
import { pickSampleRoof, roofStats, USABLE_FRACTION } from "./roof";
import { toGeoJSON } from "./overpass";

// Square building of side `deg` degrees with its south-west corner at (lat, lon), near the equator.
const square = (id: number, lat: number, lon: number, deg: number): Feature<Polygon> =>
  toGeoJSON([{ type: "way", id, geometry: [{ lat, lon }, { lat, lon: lon + deg }, { lat: lat + deg, lon: lon + deg }, { lat: lat + deg, lon }] }]).features[0]!;
const all = () => true;

describe("roof", () => {
  it("usable area is 65% of roof area", () => {
    expect(USABLE_FRACTION).toBe(0.65);
    const s = roofStats(square(1, 0, 0, 0.001));
    expect(s.usable).toBeCloseTo(s.area * 0.65, 6);
    expect(s.area).toBeGreaterThan(12000);
  });

  it("sample roof skips buildings under 150 m² or over 1500 m²", () => {
    const tiny = square(1, 0, 0, 0.0001); // ~124 m²
    const huge = square(2, 0, 0, 0.0004); // ~1980 m²
    expect(roofStats(tiny).area).toBeLessThan(150);
    expect(roofStats(huge).area).toBeGreaterThan(1500);
    expect(pickSampleRoof([tiny, huge], { lat: 0, lng: 0 }, all)).toBeNull();
  });

  it("sample roof picks the qualifying building closest to the map centre", () => {
    const near = square(1, 0.001, 0.001, 0.0002); // ~495 m²
    const far = square(2, 0.005, 0.005, 0.0002);
    expect(pickSampleRoof([far, near], { lat: 0, lng: 0 }, all)?.properties?.["id"]).toBe("way/1");
  });

  it("sample roof ignores buildings outside the view", () => {
    const b = square(1, 0.001, 0.001, 0.0002);
    expect(pickSampleRoof([b], { lat: 0, lng: 0 }, () => false)).toBeNull();
  });
});
