export type Place = { lat: number; lon: number; name: string };

export async function searchAddress(q: string): Promise<Place | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("search failed");
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const first = data[0];
  return first ? { lat: Number(first.lat), lon: Number(first.lon), name: first.display_name } : null;
}
