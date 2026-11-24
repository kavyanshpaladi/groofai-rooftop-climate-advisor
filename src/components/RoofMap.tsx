import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Polygon, TileLayer, ZoomControl } from "react-leaflet";
import type { Feature, FeatureCollection, Polygon as GPolygon } from "geojson";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { BuildingsLayer, toLatLngs } from "./BuildingsLayer";
import { SearchBox } from "./SearchBox";
import { RoofPanel } from "./RoofPanel";
import { Loader2, MousePointerClick, X } from "lucide-react";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import centroid from "@turf/centroid";
import { fetchBuildingsAround } from "@/lib/overpass";

const NOT_FOUND = "No building found here. Try zooming in or use Draw my roof.";
import { SAMPLE_ROOF, START } from "@/lib/roof";

export default function RoofMap() {
  const [map, setMap] = useState<L.Map | null>(null);
  const [data, setData] = useState<FeatureCollection<GPolygon> | null>(null);
  const [status, setStatus] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [selected, setSelected] = useState<Feature<GPolygon> | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [drawReady, setDrawReady] = useState(false);
  const [mode, setMode] = useState<"none" | "draw" | "tap">("none");
  const [tapBusy, setTapBusy] = useState(false);
  const [tapMsg, setTapMsg] = useState<string | null>(null);
  const busyRef = useRef(false);

  const pick = (f: Feature<GPolygon>) => { setSelected(f); setMode("none"); };
  const toggle = (m: "draw" | "tap") => setMode((cur) => (cur === m ? "none" : m));

  useEffect(() => { setTapMsg(null); }, [mode]);

  useEffect(() => {
    if (!map || mode !== "tap") return;
    const el = map.getContainer();
    el.style.cursor = "crosshair";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMode("none"); };
    const onClick = async (e: L.LeafletMouseEvent) => {
      if (busyRef.current) return;
      const { lat, lng } = e.latlng;
      const pt: [number, number] = [lng, lat];
      const hit = data?.features.find((f) => booleanPointInPolygon(pt, f));
      if (hit) { pick(hit); return; }
      busyRef.current = true; setTapBusy(true); setTapMsg(null);
      try {
        const fc = await fetchBuildingsAround(lat, lng);
        const inside = fc.features.find((f) => booleanPointInPolygon(pt, f));
        const d = (f: Feature<GPolygon>) => { const [x, y] = centroid(f).geometry.coordinates as [number, number]; return (x - lng) ** 2 + (y - lat) ** 2; };
        const found = inside ?? [...fc.features].sort((a, b) => d(a) - d(b))[0];
        if (found) pick(found); else setTapMsg(NOT_FOUND);
      } catch { setTapMsg(NOT_FOUND); }
      finally { busyRef.current = false; setTapBusy(false); }
    };
    map.on("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { el.style.cursor = ""; map.off("click", onClick); document.removeEventListener("keydown", onKey); };
  }, [map, mode, data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map) return;
    let off = () => {};
    (async () => {
      (window as unknown as { L: typeof L }).L = L;
      await import("leaflet-draw");
      const onCreated = (e: L.LeafletEvent) => {
        const gj = (e as L.DrawEvents.Created).layer.toGeoJSON() as Feature<GPolygon>;
        pick({ ...gj, id: "drawn", properties: { id: `drawn-${Date.now()}` } });
      };
      const onStop = () => setMode((cur) => (cur === "draw" ? "none" : cur));
      map.on(L.Draw.Event.CREATED, onCreated);
      map.on(L.Draw.Event.DRAWSTOP, onStop);
      off = () => { map.off(L.Draw.Event.CREATED, onCreated); map.off(L.Draw.Event.DRAWSTOP, onStop); };
      setDrawReady(true);
    })();
    return () => off();
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map || !drawReady || mode !== "draw") return;
    const tool = new L.Draw.Polygon(map as L.DrawMap, { shapeOptions: { className: "roof-selected" } });
    tool.enable();
    return () => { tool.disable(); };
  }, [map, drawReady, mode]);

  const sample = () => {
    pick(SAMPLE_ROOF);
    map?.setView(START, 19);
  };

  const selectedId = selected ? String(selected.properties?.["id"]) : null;

  return (
    <div className={`roof-map relative h-dvh w-full ${selected ? "roof-map-selected" : ""}`}>
      <MapContainer center={START} zoom={17} maxZoom={21} scrollWheelZoom preferCanvas ref={setMap} className="h-full w-full" zoomControl={false}>
        <ZoomControl position="bottomleft" />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community | Buildings &copy; OpenStreetMap contributors"
          maxNativeZoom={19}
          maxZoom={21}
        />
        <BuildingsLayer active={mode === "tap"} data={data} selectedId={selectedId} onData={setData} onStatus={setStatus} onSelect={pick} retryKey={retryKey} />
        {selected && (
          <Polygon positions={toLatLngs(selected)} pathOptions={{ color: "#1d4ed8", fillColor: "#1d4ed8", weight: 4, fillOpacity: 0.55 }} />
        )}
      </MapContainer>

      <div className="absolute inset-x-3 top-3 z-[1000] flex flex-col gap-2 md:left-4 md:right-auto md:w-96">
        <SearchBox map={map} onSearch={() => setMode("none")} />
        <div className="flex gap-2">
          <Button onClick={() => toggle("draw")} disabled={!drawReady} variant={mode === "draw" ? "default" : "outline"} aria-pressed={mode === "draw"} className={mode === "draw" ? "px-3" : "bg-card px-3"}>Draw my roof</Button>
          <Button onClick={sample} variant="outline" className="bg-card px-3">Try a sample roof</Button>
          <Button onClick={() => toggle("tap")} variant={mode === "tap" ? "default" : "outline"} aria-pressed={mode === "tap"} className={mode === "tap" ? "px-3" : "bg-card px-3"}><MousePointerClick />Tap a building</Button>
        </div>
        {mode === "tap" && <p className="w-fit rounded-md bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">{tapBusy ? "Finding building…" : "Tap a building to select its roof"}</p>}
        {mode === "tap" && tapMsg && <p className="w-fit rounded-md bg-card px-2 py-1 text-xs text-destructive shadow-sm">{tapMsg}</p>}
        {mode === "tap" && status.loading && <p className="pointer-events-none flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm"><Loader2 className="size-3 animate-spin" />Loading buildings...</p>}
        {mode === "tap" && status.error && (
          <div className="flex w-fit items-center gap-2 rounded-md bg-card px-2 py-1 text-xs shadow-sm">
            <span className="text-destructive">{status.error}</span>
            <Button onClick={() => setRetryKey((k) => k + 1)} size="sm" className="h-6 px-2">Retry</Button>
            <Button onClick={() => setStatus({ loading: false, error: null })} size="icon" variant="ghost" className="size-6" aria-label="Dismiss"><X /></Button>
          </div>
        )}
        {mode === "tap" && map && !status.loading && !status.error && !data && <p className="w-fit rounded-md bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">Zoom in to see buildings</p>}
      </div>

      {selected && <RoofPanel roof={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
