import { describe, expect, it } from "vitest";
import type { Feature, Polygon } from "geojson";
import { BUILDING_OFFSET_M, MIN_ROOF_AREA, shiftFeature, outlineCoords, pickRoofAt, roofStats, sampleRoofFeature, SAMPLE_ROOF_CENTER, SAMPLE_ROOF_POLYGON, SAMPLE_ROOF_ZOOM, USABLE_FRACTION } from "./roof";
import { toGeoJSON } from "./overpass";

// Square building of side `deg` degrees with its south-west corner at (lat, lon), near the equator.
const square = (id: number, lat: number, lon: number, deg: number): Feature<Polygon> =>
  toGeoJSON([{ type: "way", id, geometry: [{ lat, lon }, { lat, lon: lon + deg }, { lat: lat + deg, lon: lon + deg }, { lat: lat + deg, lon }] }]).features[0]!;
const id = (f: Feature<Polygon> | null) => f?.properties?.["id"];

describe("roof", () => {
  it("usable area is 65% of roof area", () => {
    expect(USABLE_FRACTION).toBe(0.65);
    const s = roofStats(square(1, 0, 0, 0.001));
    expect(s.usable).toBeCloseTo(s.area * 0.65, 6);
    expect(s.area).toBeGreaterThan(12000);
  });

  it("sample roof is fixed at 17.40929, 78.45809 and zoom 19", () => {
    expect(SAMPLE_ROOF_CENTER).toEqual({ lat: 17.40929, lng: 78.45809 });
    expect(SAMPLE_ROOF_ZOOM).toBe(19);
  });

  it("sample roof is one ~8-corner outline of roughly 500 m²", () => {
    expect(SAMPLE_ROOF_POLYGON).toHaveLength(8);
    const s = roofStats(sampleRoofFeature());
    expect(s.area).toBeGreaterThan(450);
    expect(s.area).toBeLessThan(560);
  });

  it("sample roof keeps every vertex exactly as given", () => {
    expect(outlineCoords(sampleRoofFeature())).toEqual(SAMPLE_ROOF_POLYGON);
  });

  it("copied outline coordinates are rounded to 6 decimals", () => {
    const f = toGeoJSON([{ type: "way", id: 9, geometry: [{ lat: 1.23456789, lon: 2.1 }, { lat: 1.3, lon: 2.2 }, { lat: 1.4, lon: 2.123456449 }] }]).features[0]!;
    expect(outlineCoords(f)).toEqual([[1.234568, 2.1], [1.3, 2.2], [1.4, 2.123456]]);
  });

  it("picks the building that contains the point", () => {
    const home = square(1, 0, 0, 0.0002); // ~495 m²
    const next = square(2, 0, 0.0003, 0.0002);
    expect(id(pickRoofAt([next, home], { lat: 0.0001, lng: 0.0001 }, 40))).toBe("way/1");
  });

  it("falls back to the nearest building within 40 m", () => {
    const near = square(1, 0, 0.0003, 0.0002); // edge ~33 m east of the point
    const far = square(2, 0, 0.0006, 0.0002); // edge ~67 m east
    expect(id(pickRoofAt([far, near], { lat: 0.0001, lng: 0 }, 40))).toBe("way/1");
  });

  it("ignores buildings further than 40 m", () => {
    const far = square(1, 0, 0.0005, 0.0002); // edge ~56 m away
    expect(pickRoofAt([far], { lat: 0.0001, lng: 0 }, 40)).toBeNull();
  });

  it("ignores buildings smaller than 20 m²", () => {
    expect(MIN_ROOF_AREA).toBe(20);
    const shed = square(1, 0, 0, 0.00003); // ~11 m²
    expect(roofStats(shed).area).toBeLessThan(20);
    expect(pickRoofAt([shed], { lat: 0.000015, lng: 0.000015 }, 40)).toBeNull();
  });

  it("a tap on empty ground selects nothing", () => {
    const b = square(1, 0, 0.0003, 0.0002);
    expect(pickRoofAt([b], { lat: 0.0001, lng: 0 }, 0)).toBeNull();
  });

  it("building offset starts at 0 m east, 0 m north", () => {
    expect(BUILDING_OFFSET_M).toEqual({ east: 0, north: 0 });
  });

  it("shifting a building moves its centre by the given metres and keeps its area", () => {
    const f = square(9, 17.409, 78.458, 0.0002);
    const before = roofStats(f);
    const after = roofStats(shiftFeature(f, { east: 2, north: -1.5 }));
    expect(after.area).toBeCloseTo(before.area, 2);
    const northM = (after.lat - before.lat) * 111320;
    const eastM = (after.lon - before.lon) * 111320 * Math.cos((17.409 * Math.PI) / 180);
    expect(northM).toBeCloseTo(-1.5, 2);
    expect(eastM).toBeCloseTo(2, 2);
  });

  it("a zero offset leaves the building untouched", () => {
    const f = square(10, 17.409, 78.458, 0.0002);
    expect(shiftFeature(f, { east: 0, north: 0 })).toBe(f);
  });
});
