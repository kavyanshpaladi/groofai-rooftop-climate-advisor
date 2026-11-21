import type { Feature, FeatureCollection, Polygon } from "geojson";

export type BBox = { south: number; west: number; north: number; east: number };

const cache = new Map<string, FeatureCollection<Polygon>>();

export function bboxKey(b: BBox) {
  return [b.south, b.west, b.north, b.east].map((n) => n.toFixed(4)).join(",");
}

type OverpassWay = { type: string; id: number; geometry?: { lat: number; lon: number }[] };

export function toGeoJSON(elements: OverpassWay[]): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];
  for (const el of elements) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 3) continue;
    const ring = el.geometry.map((p) => [p.lon, p.lat]);
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0]!, first[1]!]);
    if (ring.length < 4) continue;
    features.push({
      type: "Feature",
      id: `way/${el.id}`,
      properties: { id: `way/${el.id}` },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }
  return { type: "FeatureCollection", features };
}

export async function fetchBuildings(b: BBox, signal?: AbortSignal) {
  const key = bboxKey(b);
  const hit = cache.get(key);
  if (hit) return hit;
  const query = `[out:json][timeout:25];way["building"](${b.south},${b.west},${b.north},${b.east});out geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal: signal ?? null,
  });
  if (res.status === 429 || res.status === 504) throw new Error("busy");
  if (!res.ok) throw new Error("failed");
  const json = (await res.json()) as { elements: OverpassWay[] };
  const fc = toGeoJSON(json.elements ?? []);
  cache.set(key, fc);
  return fc;
}
