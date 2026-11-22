import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, Polygon, TileLayer, ZoomControl } from "react-leaflet";
import type { Feature, FeatureCollection, Polygon as GPolygon } from "geojson";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { BuildingsLayer, toLatLngs } from "./BuildingsLayer";
import { SearchBox } from "./SearchBox";
import { RoofPanel } from "./RoofPanel";
import { SAMPLE_ROOF, START } from "@/lib/roof";

export default function RoofMap() {
  const [map, setMap] = useState<L.Map | null>(null);
  const [data, setData] = useState<FeatureCollection<GPolygon> | null>(null);
  const [status, setStatus] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [selected, setSelected] = useState<Feature<GPolygon> | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [drawReady, setDrawReady] = useState(false);

  useEffect(() => {
    if (!map) return;
    let off = () => {};
    (async () => {
      (window as unknown as { L: typeof L }).L = L;
      await import("leaflet-draw");
      const onCreated = (e: L.LeafletEvent) => {
        const gj = (e as L.DrawEvents.Created).layer.toGeoJSON() as Feature<GPolygon>;
        setSelected({ ...gj, id: "drawn", properties: { id: `drawn-${Date.now()}` } });
      };
      map.on(L.Draw.Event.CREATED, onCreated);
      off = () => map.off(L.Draw.Event.CREATED, onCreated);
      setDrawReady(true);
    })();
    return () => off();
  }, [map]);

  const draw = () => {
    if (!map || !drawReady) return;
    new L.Draw.Polygon(map as L.DrawMap, { shapeOptions: { className: "roof-selected" } }).enable();
  };

  const sample = () => {
    setSelected(SAMPLE_ROOF);
    map?.setView(START, 19);
  };

  const selectedId = selected ? String(selected.properties?.["id"]) : null;

  return (
    <div className={`roof-map relative h-dvh w-full ${selected ? "roof-map-selected" : ""}`}>
      <MapContainer center={START} zoom={17} maxZoom={21} scrollWheelZoom ref={setMap} className="h-full w-full" zoomControl={false}>
        <ZoomControl position="bottomleft" />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community | Buildings &copy; OpenStreetMap contributors"
          maxNativeZoom={19}
          maxZoom={21}
        />
        <BuildingsLayer data={data} selectedId={selectedId} onData={setData} onStatus={setStatus} onSelect={setSelected} retryKey={retryKey} />
        {selected && (
          <Polygon positions={toLatLngs(selected)} pathOptions={{ className: "roof-selected", weight: 3, fillOpacity: 0.45 }} />
        )}
      </MapContainer>

      <div className="absolute inset-x-3 top-3 z-[1000] flex flex-col gap-2 md:left-4 md:right-auto md:w-96">
        <SearchBox map={map} />
        <div className="flex gap-2">
          <Button onClick={draw} disabled={!drawReady} variant="outline" className="bg-card px-3">Draw my roof</Button>
          <Button onClick={sample} variant="outline" className="bg-card px-3">Try a sample roof</Button>
        </div>
        {status.loading && <p className="w-fit rounded-md bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">Loading buildings…</p>}
        {status.error && (
          <div className="flex w-fit items-center gap-2 rounded-md bg-card px-2 py-1 text-xs shadow-sm">
            <span className="text-destructive">{status.error}</span>
            <Button onClick={() => setRetryKey((k) => k + 1)} size="sm" className="h-6 px-2">Retry</Button>
          </div>
        )}
        {map && !status.loading && !status.error && !data && <p className="w-fit rounded-md bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">Zoom in to see buildings</p>}
      </div>

      {selected && <RoofPanel roof={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
