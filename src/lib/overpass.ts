import type { Feature, FeatureCollection, Polygon } from "geojson";

export type BBox = { south: number; west: number; north: number; east: number };

export const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const TIMEOUT_MS = 25000;

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
  const fc = await runQuery(`[out:json][timeout:15];way["building"](${b.south},${b.west},${b.north},${b.east});out geom;`, signal);
  cache.set(key, fc);
  return fc;
}

export function fetchBuildingsLight(b: BBox, signal?: AbortSignal) {
  return runQuery(`[out:json][timeout:20];way["building"](${b.south},${b.west},${b.north},${b.east});out skel geom qt;`, signal);
}

export function fetchBuildingsAround(lat: number, lon: number, signal?: AbortSignal) {
  return runQuery(`[out:json][timeout:15];way(around:15,${lat},${lon})["building"];out skel geom qt;`, signal);
}

async function tryMirror(url: string, query: string, signal: AbortSignal) {
  const res = await fetch(url, {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal,
  });
  if (!res.ok) throw new Error(res.status === 429 || res.status >= 502 ? "busy" : "failed");
  const json = (await res.json()) as { elements?: OverpassWay[]; remark?: string };
  // Overpass reports timeouts/overload as 200 with a "remark" and partial data; never cache that.
  if (json.remark && /error|timed out|out of memory/i.test(json.remark)) throw new Error("busy");
  return json.elements ?? [];
}

// Ask every mirror at once and keep the first full answer; slow or overloaded mirrors are cancelled.
async function runQuery(query: string, signal?: AbortSignal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const race = new AbortController();
    const stop = () => race.abort();
    signal?.addEventListener("abort", stop);
    try {
      const sig = AbortSignal.any([race.signal, AbortSignal.timeout(TIMEOUT_MS)]);
      const elements = await Promise.any(MIRRORS.map((url) => tryMirror(url, query, sig)));
      return toGeoJSON(elements);
    } catch (e) {
      if (signal?.aborted) throw e;
    } finally {
      race.abort();
      signal?.removeEventListener("abort", stop);
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("failed");
}
