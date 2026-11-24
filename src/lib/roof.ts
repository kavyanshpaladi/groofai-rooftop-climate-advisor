import area from "@turf/area";
import centroid from "@turf/centroid";
import type { Feature, Polygon } from "geojson";

export const USABLE_FRACTION = 0.65;

export function roofStats(f: Feature<Polygon>) {
  const a = area(f);
  const c = centroid(f).geometry.coordinates;
  return { area: a, usable: a * USABLE_FRACTION, lat: c[1]!, lon: c[0]! };
}

export const START: [number, number] = [17.385, 78.4867];

export const SAMPLE_MIN_AREA = 150;
export const SAMPLE_MAX_AREA = 1500;

// Building with area 150–1500 m² whose centroid is closest to the map centre (and inside the view).
export function pickSampleRoof(
  features: Feature<Polygon>[],
  center: { lat: number; lng: number },
  inView: (lat: number, lng: number) => boolean,
) {
  const k = Math.cos((center.lat * Math.PI) / 180);
  let best: Feature<Polygon> | null = null; let bestD = Infinity;
  for (const f of features) {
    const s = roofStats(f);
    if (s.area < SAMPLE_MIN_AREA || s.area > SAMPLE_MAX_AREA || !inView(s.lat, s.lon)) continue;
    const d = (s.lat - center.lat) ** 2 + ((s.lon - center.lng) * k) ** 2;
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}
