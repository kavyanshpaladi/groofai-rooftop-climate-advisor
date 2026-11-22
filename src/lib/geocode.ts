export type Place = { lat: number; lon: number; name: string };

export async function searchAddress(q: string): Promise<Place | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("search failed");
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const first = data[0];
  return first ? { lat: Number(first.lat), lon: Number(first.lon), name: first.display_name } : null;
}

export type Suggestion = Place & { id: string; detail: string };

type PhotonFeature = {
  geometry?: { coordinates?: number[] };
  properties?: Record<string, unknown>;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** Turn a Photon response into up to `limit` unique suggestions. */
export function parsePhoton(json: unknown, limit = 6): Suggestion[] {
  const features = ((json as { features?: PhotonFeature[] })?.features ?? []);
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const f of features) {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const p = f.properties ?? {};
    const street = [str(p["street"]), str(p["housenumber"])].filter(Boolean).join(" ");
    const name = str(p["name"]) || street || str(p["city"]) || str(p["state"]);
    if (!name) continue;
    const parts = [str(p["district"]) || str(p["locality"]), str(p["city"]) || str(p["county"]), str(p["state"]), str(p["country"])];
    const detail = parts
      .filter((x, i) => x && x.toLowerCase() !== name.toLowerCase() && parts.indexOf(x) === i)
      .join(", ");
    const key = `${name}|${detail}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `${str(p["osm_type"])}${String(p["osm_id"] ?? out.length)}-${out.length}`, lat, lon, name, detail });
    if (out.length >= limit) break;
  }
  return out;
}

export async function fetchSuggestions(q: string, signal: AbortSignal): Promise<Suggestion[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&lat=17.385&lon=78.4867`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("photon failed");
  return parsePhoton(await res.json());
}
