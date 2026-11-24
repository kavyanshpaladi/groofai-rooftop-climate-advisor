import area from "@turf/area";
import centroid from "@turf/centroid";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, Polygon } from "geojson";

export const USABLE_FRACTION = 0.65;

export function roofStats(f: Feature<Polygon>) {
  const a = area(f);
  const c = centroid(f).geometry.coordinates;
  return { area: a, usable: a * USABLE_FRACTION, lat: c[1]!, lon: c[0]! };
}

export const START: [number, number] = [17.385, 78.4867];

// The one fixed place "Try a sample roof" always goes to.
export const SAMPLE_ROOF_CENTER = { lat: 17.40929, lng: 78.45809 };
export const SAMPLE_ROOF_ZOOM = 19;

// Hand-traced outline of the sample roof as [lat, lng], clockwise from the top-left.
// Shown exactly as given: never simplified, snapped or boxed.
export const SAMPLE_ROOF_POLYGON: [number, number][] = [
  [17.409318, 78.457938],
  [17.409318, 78.458009],
  [17.409381, 78.458009],
  [17.409388, 78.458194],
  [17.40928, 78.458198],
  [17.409278, 78.458194],
  [17.409215, 78.458199],
  [17.409174, 78.457943],
];

export function sampleRoofFeature(): Feature<Polygon> {
  const ring = SAMPLE_ROOF_POLYGON.map(([lat, lng]) => [lng, lat]);
  ring.push([...ring[0]!]);
  return { type: "Feature", id: "sample", properties: { id: `sample-${Date.now()}` }, geometry: { type: "Polygon", coordinates: [ring] } };
}

// Outline vertices as [lat, lng] rounded to 6 decimals, without the closing repeat.
export function outlineCoords(f: Feature<Polygon>): [number, number][] {
  const ring = f.geometry.coordinates[0] ?? [];
  const pts = ring.map(([lng, lat]) => [Number(lat!.toFixed(6)), Number(lng!.toFixed(6))] as [number, number]);
  const a = pts[0], b = pts[pts.length - 1];
  if (pts.length > 1 && a && b && a[0] === b[0] && a[1] === b[1]) pts.pop();
  return pts;
}

// Map-data building outlines can sit a few metres off the satellite photo. Every building
// outline is shifted by this many metres before it is shown, picked or measured.
// Drawn outlines and the hand-traced sample are never shifted.
export type Offset = { east: number; north: number };
export const BUILDING_OFFSET_M: Offset = { east: 0, north: 0 };

// Degrees of latitude/longitude for a shift of `east`/`north` metres at latitude `lat`.
export function metersToDegrees(lat: number, east: number, north: number) {
  return { dLat: north / 111320, dLng: east / (111320 * Math.cos((lat * Math.PI) / 180)) };
}

// The same outline moved by a fixed distance: shape and area stay the same.
export function shiftFeature(f: Feature<Polygon>, off: Offset): Feature<Polygon> {
  if (!off.east && !off.north) return f;
  const lat0 = f.geometry.coordinates[0]?.[0]?.[1] ?? 0;
  const { dLat, dLng } = metersToDegrees(lat0, off.east, off.north);
  const coordinates = f.geometry.coordinates.map((ring) => ring.map(([lng, lat]) => [lng! + dLng, lat! + dLat]));
  return { ...f, geometry: { type: "Polygon", coordinates } };
}

// Building outlines smaller than this are sheds, kiosks or mapping noise, not roofs.
export const MIN_ROOF_AREA = 20;

type Pt = { lat: number; lng: number };

// Shortest distance in metres from a point to a building outline (0 when inside).
export function distanceToRoof(f: Feature<Polygon>, p: Pt) {
  if (booleanPointInPolygon([p.lng, p.lat], f)) return 0;
  const kx = 111320 * Math.cos((p.lat * Math.PI) / 180), ky = 110540;
  const ring = (f.geometry.coordinates[0] ?? []).map(([lon, lat]) => [(lon! - p.lng) * kx, (lat! - p.lat) * ky] as const);
  let best = Infinity;
  for (let i = 0; i + 1 < ring.length; i++) {
    const [ax, ay] = ring[i]!, [bx, by] = ring[i + 1]!;
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

// Building (≥ 20 m²) containing the point — the smallest one if several overlap —
// otherwise the nearest building within `maxMeters`. Null when nothing qualifies.
export function pickRoofAt(features: Feature<Polygon>[], p: Pt, maxMeters: number) {
  let best: Feature<Polygon> | null = null; let bestD = Infinity; let bestA = Infinity;
  for (const f of features) {
    const a = area(f);
    if (a < MIN_ROOF_AREA) continue;
    const d = distanceToRoof(f, p);
    if (d > maxMeters) continue;
    if (d < bestD || (d === bestD && a < bestA)) { best = f; bestD = d; bestA = a; }
  }
  return best;
}
