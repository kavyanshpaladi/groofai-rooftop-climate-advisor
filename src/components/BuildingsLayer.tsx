import { useEffect, useRef } from "react";
import { Polygon, useMap, useMapEvents } from "react-leaflet";
import type { Feature, FeatureCollection, Polygon as GPolygon } from "geojson";
import { fetchBuildings } from "@/lib/overpass";

type Props = {
  data: FeatureCollection<GPolygon> | null;
  selectedId: string | null;
  onData: (fc: FeatureCollection<GPolygon> | null) => void;
  onStatus: (s: { loading: boolean; error: string | null }) => void;
  retryKey: number;
  onSelect: (f: Feature<GPolygon>) => void;
};

const toLatLngs = (f: Feature<GPolygon>) => f.geometry.coordinates[0]!.map(([lon, lat]) => [lat!, lon!] as [number, number]);

export function BuildingsLayer({ data, selectedId, onData, onStatus, onSelect, retryKey }: Props) {
  const map = useMap();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ctrl = useRef<AbortController | null>(null);

  const load = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (map.getZoom() < 17) { onData(null); onStatus({ loading: false, error: null }); return; }
      const b = map.getBounds();
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      onStatus({ loading: true, error: null });
      try {
        const fc = await fetchBuildings({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, ctrl.current.signal);
        onData(fc);
        onStatus({ loading: false, error: null });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        onStatus({ loading: false, error: "Couldn't load buildings" });
      }
    }, 800);
  };

  useMapEvents({ moveend: load });
  useEffect(() => { load(); return () => clearTimeout(timer.current); }, [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {data?.features.map((f) => {
        const id = String(f.properties?.["id"]);
        if (id === selectedId) return null;
        return (
          <Polygon key={id} positions={toLatLngs(f)}
            pathOptions={{ color: "#16a34a", weight: 1, fillColor: "#22c55e", fillOpacity: 0.3 }}
            eventHandlers={{ click: () => onSelect(f) }} />
        );
      })}
    </>
  );
}

export { toLatLngs };
