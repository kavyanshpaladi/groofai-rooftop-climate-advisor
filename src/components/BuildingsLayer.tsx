import { useEffect, useMemo, useRef, useState } from "react";
import { Polygon, useMap, useMapEvents } from "react-leaflet";
import type { Feature, FeatureCollection, Polygon as GPolygon } from "geojson";
import area from "@turf/area";
import { fetchBuildingsLight } from "@/lib/overpass";
import { MIN_ROOF_AREA, shiftFeature, type Offset } from "@/lib/roof";
import { themeColor } from "@/lib/map-colors";

type Props = {
  active: boolean;
  data: FeatureCollection<GPolygon> | null;
  selectedId: string | null;
  onData: (fc: FeatureCollection<GPolygon> | null) => void;
  onStatus: (s: { loading: boolean; error: string | null }) => void;
  retryKey: number;
  // Shift applied to every building outline before it is shown or picked.
  offset: Offset;
};

const TILE = 0.003;
const MAX = 1500;
// Thin, light outlines so the satellite roofs underneath stay readable.
const style = (hover: boolean) => {
  const c = themeColor("--primary", "#2563eb");
  // smoothFactor 0: draw every corner of the building, never simplified at any zoom.
  return { color: c, fillColor: c, weight: hover ? 1.5 : 1, opacity: hover ? 1 : 0.8, fillOpacity: hover ? 0.2 : 0.06, smoothFactor: 0 };
};
const tiles = new Map<string, Feature<GPolygon>[]>();
const SS = "groofai-tile-v3-";

function getTile(k: string) {
  const hit = tiles.get(k);
  if (hit) return hit;
  try {
    const raw = sessionStorage.getItem(SS + k);
    if (raw) { const f = JSON.parse(raw) as Feature<GPolygon>[]; tiles.set(k, f); return f; }
  } catch { /* ignore */ }
  return undefined;
}
function putTile(k: string, f: Feature<GPolygon>[]) {
  tiles.set(k, f);
  try { sessionStorage.setItem(SS + k, JSON.stringify(f)); } catch { /* quota */ }
}

// Fetch the given missing tiles in one light query and cache each tile's buildings.
async function fillTiles(missing: [number, number][], signal?: AbortSignal) {
  const mi = missing.map((m) => m[0]), mj = missing.map((m) => m[1]);
  const box = { south: Math.min(...mi) * TILE, north: (Math.max(...mi) + 1) * TILE, west: Math.min(...mj) * TILE, east: (Math.max(...mj) + 1) * TILE };
  const fc = await fetchBuildingsLight(box, signal);
  const buckets = new Map<string, Feature<GPolygon>[]>(missing.map(([i, j]) => [`${i},${j}`, []]));
  for (const f of fc.features) {
    const [lon, lat] = f.geometry.coordinates[0]?.[0] ?? [];
    if (typeof lon !== "number" || typeof lat !== "number") continue;
    buckets.get(`${Math.floor(lat / TILE)},${Math.floor(lon / TILE)}`)?.push(f);
  }
  buckets.forEach((f, k) => putTile(k, f.filter((b) => area(b) >= MIN_ROOF_AREA)));
}

// All buildings in the given bounds, using cached tiles and fetching only the missing ones.
export async function loadBuildingsIn(b: { getSouth(): number; getNorth(): number; getWest(): number; getEast(): number }, signal?: AbortSignal) {
  const i0 = Math.floor(b.getSouth() / TILE), i1 = Math.floor(b.getNorth() / TILE);
  const j0 = Math.floor(b.getWest() / TILE), j1 = Math.floor(b.getEast() / TILE);
  const keys: string[] = []; const missing: [number, number][] = [];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const k = `${i},${j}`; keys.push(k);
    if (!getTile(k)) missing.push([i, j]);
  }
  if (missing.length) await fillTiles(missing, signal);
  const seen = new Set<string>(); const out: Feature<GPolygon>[] = [];
  for (const k of keys) for (const f of getTile(k) ?? []) {
    const id = String(f.properties?.["id"]);
    if (!seen.has(id)) { seen.add(id); out.push(f); }
  }
  return out;
}

const toLatLngs = (f: Feature<GPolygon>): [number, number][] => (f.geometry.coordinates[0] ?? []).flatMap(([lon, lat]) => typeof lon === "number" && typeof lat === "number" ? [[lat, lon] as [number, number]] : []);

export function BuildingsLayer({ active, selectedId, onData, onStatus, retryKey, offset }: Props) {
  const map = useMap();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ctrl = useRef<AbortController | null>(null);
  // Raw outlines in view; null when zoomed out too far to show any.
  const [view, setView] = useState<Feature<GPolygon>[] | null>(null);
  const shown = useMemo(() => view?.map((f) => shiftFeature(f, offset)) ?? null, [view, offset]);
  useEffect(() => { onData(shown ? { type: "FeatureCollection", features: shown } : null); }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeRef = useRef(active);
  activeRef.current = active;

  const collect = (keys: string[]) => {
    const seen = new Set<string>(); const out: Feature<GPolygon>[] = [];
    for (const k of keys) for (const f of getTile(k) ?? []) {
      const id = String(f.properties?.["id"]);
      if (seen.has(id)) continue;
      seen.add(id); out.push(f);
      if (out.length >= MAX) return out;
    }
    return out;
  };

  const show = (keys: string[]) => {
    setView(collect(keys));
  };

  const load = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      ctrl.current?.abort();
      if (!activeRef.current) { onStatus({ loading: false, error: null }); return; }
      if (map.getZoom() < 17) { setView(null); onStatus({ loading: false, error: null }); return; }
      const b = map.getBounds();
      const i0 = Math.floor(b.getSouth() / TILE), i1 = Math.floor(b.getNorth() / TILE);
      const j0 = Math.floor(b.getWest() / TILE), j1 = Math.floor(b.getEast() / TILE);
      const keys: string[] = []; const missing: [number, number][] = [];
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const k = `${i},${j}`; keys.push(k);
        if (!getTile(k)) missing.push([i, j]);
      }
      show(keys);
      if (!missing.length) { onStatus({ loading: false, error: null }); return; }
      const c = new AbortController(); ctrl.current = c;
      onStatus({ loading: true, error: null });
      try {
        await fillTiles(missing, c.signal);
        if (c.signal.aborted) return;
        show(keys);
        onStatus({ loading: false, error: null });
      } catch {
        if (c.signal.aborted) return;
        onStatus({ loading: false, error: "Couldn't load buildings." });
      }
    }, 600);
  };

  useMapEvents({ moveend: load });
  useEffect(() => { load(); return () => { clearTimeout(timer.current); ctrl.current?.abort(); }; }, [retryKey, active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null;
  const base = style(false), hover = style(true);

  return (
    <>
      {(shown ?? []).map((f) => {
        const id = String(f.properties?.["id"]);
        if (id === selectedId) return null;
        return (
          // Selection is handled by the map's own click so a tap is only ever counted once.
          <Polygon key={id} positions={toLatLngs(f)} pathOptions={base}
            eventHandlers={{
              mouseover: (e) => e.target.setStyle(hover),
              mouseout: (e) => e.target.setStyle(base),
            }} />
        );
      })}
    </>
  );
}

export { toLatLngs };
