import type { Feature, FeatureCollection, Polygon } from "geojson";

export type BBox = { south: number; west: number; north: number; east: number };

export const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

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
  const query = `[out:json][timeout:15];way["building"](${b.south},${b.west},${b.north},${b.east});out geom;`;
  let json: { elements: OverpassWay[] } | null = null;
  let busy = false;
  for (let attempt = 0; attempt < 2 && !json; attempt++) {
    for (const url of MIRRORS) {
      try {
        const t = AbortSignal.timeout(15000);
        const res = await fetch(url, {
          method: "POST",
          body: "data=" + encodeURIComponent(query),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: signal ? AbortSignal.any([signal, t]) : t,
        });
        if (res.status === 429 || res.status === 504) { busy = true; continue; }
        if (!res.ok) continue;
        json = (await res.json()) as { elements: OverpassWay[] };
        break;
      } catch (e) {
        if (signal?.aborted) throw e;
      }
    }
    if (!json && attempt === 0) await new Promise((r) => setTimeout(r, 1500));
  }
  if (!json) throw new Error(busy ? "busy" : "failed");
  const fc = toGeoJSON(json.elements ?? []);
  cache.set(key, fc);
  return fc;
}
