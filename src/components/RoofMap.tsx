import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";
import type { Feature, FeatureCollection, Polygon as GPolygon } from "geojson";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { BuildingsLayer, loadBuildingsIn, toLatLngs } from "./BuildingsLayer";
import { RepeatButton } from "./RepeatButton";
import { toast } from "sonner";
import { SearchBox } from "./SearchBox";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { RoofPanel } from "./RoofPanel";
import { Copy, Eye, EyeOff, Loader2, Move, MousePointerClick, RotateCcw, Spline, X } from "lucide-react";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { fetchBuildingsAround } from "@/lib/overpass";
import { BUILDING_OFFSET_M, START, SAMPLE_ROOF_CENTER, SAMPLE_ROOF_POLYGON, SAMPLE_ROOF_ZOOM, metersToDegrees, outlineCoords, pickRoofAt, sampleRoofFeature, shiftFeature, type Offset } from "@/lib/roof";
import { themeColor } from "@/lib/map-colors";
import { useI18n } from "@/lib/i18n";


type Mode = "none" | "draw" | "tap";
type EditTool = "none" | "move" | "corners";
type EditablePolygon = L.Polygon & { editing?: { enable(): void; disable(): void } };

const selectedStyle = () => {
  const c = themeColor("--roof-selection", "#f97316");
  // smoothFactor 0: draw every corner exactly, never simplified at any zoom.
  return { color: c, fillColor: c, weight: 2, opacity: 1, fillOpacity: 0.12, smoothFactor: 0 };
};
// Thin dashed light edge under the outline so it stays visible on dark roofs.
const casingStyle = () => ({ color: themeColor("--roof-casing", "#ffffff"), weight: 4, opacity: 0.9, dashArray: "3 4", fill: false, smoothFactor: 0, interactive: false });

const SAMPLE_FAILED = "Couldn't load the sample roof. Try 'Tap a building' or 'Draw my roof'.";
const NUDGE_M = 0.25, NUDGE_SHIFT_M = 1, CALIBRATE_M = 0.5;
const isBuilding = (f: Feature<GPolygon> | null) => String(f?.properties?.["id"] ?? "").startsWith("way/");
const round2 = (n: number) => Math.round(n * 100) / 100;
type LL = [number, number];
const ringOf = (layer: L.Polygon): LL[] => (layer.getLatLngs()[0] as L.LatLng[]).map((p) => [p.lat, p.lng]);
const shiftRing = (ring: LL[], east: number, north: number): LL[] => {
  const { dLat, dLng } = metersToDegrees(ring[0]?.[0] ?? 0, east, north);
  return ring.map(([lat, lng]) => [lat + dLat, lng + dLng]);
};

export default function RoofMap() {
  const { tx } = useI18n();
  const [map, setMap] = useState<L.Map | null>(null);
  const [data, setData] = useState<FeatureCollection<GPolygon> | null>(null);
  const [status, setStatus] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [selected, setSelected] = useState<Feature<GPolygon> | null>(null);
  // Bumped once per new selection, so live edits reshape the same outline instead of recreating it.
  const [selKey, setSelKey] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [drawReady, setDrawReady] = useState(false);
  const [mode, setMode] = useState<Mode>("none");
  const [editTool, setEditTool] = useState<EditTool>("none");
  const [tapBusy, setTapBusy] = useState(false);
  const busyRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  const [dev, setDev] = useState(false);
  useEffect(() => { setDev(new URLSearchParams(window.location.search).get("dev") === "1"); }, []);
  const layerRef = useRef<EditablePolygon | null>(null);
  const casingRef = useRef<L.Polygon | null>(null);
  // The selection's shape when it was picked, for "Reset outline".
  const originalRef = useRef<LL[]>([]);
  const [hidden, setHidden] = useState(false);
  // Bumped when the outline is shifted while corner handles are showing, so they're rebuilt in place.
  const [editRev, setEditRev] = useState(0);
  const editToolRef = useRef(editTool);
  editToolRef.current = editTool;
  const [offset, setOffset] = useState<Offset>(BUILDING_OFFSET_M);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const selectedRef = useRef<Feature<GPolygon> | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  const pick = (f: Feature<GPolygon>) => {
    originalRef.current = toLatLngs(f);
    setSelected(f); setSelKey((k) => k + 1); setEditTool("none"); setMode("none"); setHidden(false);
  };
  const clear = () => { setSelected(null); setEditTool("none"); };
  const toggle = (m: "draw" | "tap") => {
    const on = mode !== m;
    setMode(on ? m : "none");
    setEditTool("none");
    if (on && m === "draw") setSelected(null);
  };

  // Copy the outline's current shape back into the selection so the panel updates live.
  const sync = () => {
    const layer = layerRef.current;
    if (!layer) return;
    casingRef.current?.setLatLngs(layer.getLatLngs());
    const gj = layer.toGeoJSON() as Feature<GPolygon>;
    setSelected((cur) => (cur ? { ...cur, geometry: gj.geometry } : cur));
  };

  selectedRef.current = selected;

  // Reshape the selected outline in place; corner handles, if showing, are rebuilt to follow it.
  const reshape = (ring: LL[]) => {
    const layer = layerRef.current;
    if (!layer || ring.length < 3) return;
    layer.setLatLngs(ring);
    sync();
    if (editToolRef.current === "corners") setEditRev((r) => r + 1);
  };
  const nudge = (east: number, north: number) => {
    const layer = layerRef.current;
    if (layer) reshape(shiftRing(ringOf(layer), east, north));
  };
  const resetOutline = () => reshape(originalRef.current);

  // Dev calibration: shift every building outline, and a selected building with it.
  const calibrate = (east: number, north: number) => {
    const o = offsetRef.current;
    const next = { east: round2(o.east + east), north: round2(o.north + north) };
    offsetRef.current = next;
    setOffset(next);
    if (isBuilding(selectedRef.current)) {
      originalRef.current = shiftRing(originalRef.current, east, north);
      nudge(east, north);
    }
  };
  const copyOffset = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(offsetRef.current)); toast(tx("Copied")); }
    catch { toast(tx("Couldn't copy to the clipboard")); }
  };
  const resetOffset = () => {
    const o = offsetRef.current;
    if (o.east || o.north) calibrate(-o.east, -o.north);
  };

  // Arrow keys nudge the selected outline (Shift for bigger steps), unless typing in a field.
  const hasSel = selected !== null;
  useEffect(() => {
    if (!hasSel) return;
    const dirs: Record<string, LL> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const onKey = (e: KeyboardEvent) => {
      const d = dirs[e.key];
      if (!d || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true'], [role='radiogroup'], [role='listbox'], [role='menu']")) return;
      e.preventDefault(); e.stopPropagation();
      const step = e.shiftKey ? NUDGE_SHIFT_M : NUDGE_M;
      nudge(d[0] * step, d[1] * step);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [hasSel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the map sized to its box (and after the side panel opens or closes).
  useEffect(() => {
    if (!map) return;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  useEffect(() => {
    if (!map) return;
    const id = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(id);
  }, [map, hasSel]);

  // Tap mode: select the building under the click; empty ground does nothing.
  useEffect(() => {
    if (!map || mode !== "tap") return;
    const el = map.getContainer();
    el.style.cursor = "crosshair";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMode("none"); };
    const onClick = async (e: L.LeafletMouseEvent) => {
      if (busyRef.current) return;
      const pt = { lat: e.latlng.lat, lng: e.latlng.lng };
      const hit = data ? pickRoofAt(data.features, pt, 0) : null;
      if (hit) { pick(hit); return; }
      // Buildings for this view are loaded and none is here: it's empty ground.
      if (data && !statusRef.current.loading && !statusRef.current.error) return;
      busyRef.current = true; setTapBusy(true);
      try {
        const fc = await fetchBuildingsAround(pt.lat, pt.lng);
        const found = pickRoofAt(fc.features.map((f) => shiftFeature(f, offsetRef.current)), pt, 0);
        if (found) pick(found);
      } catch { /* the loading error message already explains it */ }
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
    const tool = new L.Draw.Polygon(map as L.DrawMap, { shapeOptions: selectedStyle() });
    tool.enable();
    return () => { tool.disable(); };
  }, [map, drawReady, mode]);

  // The selected outline, created once per selection and reshaped in place while editing.
  const hasSelection = selected !== null;
  useEffect(() => {
    if (!map || !selected) return;
    const st = selectedStyle();
    const casing = L.polygon(toLatLngs(selected), casingStyle());
    const layer = L.polygon(toLatLngs(selected), { ...st, interactive: false, original: st, editing: { ...st, dashArray: "4 4" } } as L.PolylineOptions) as EditablePolygon;
    casing.addTo(map);
    layer.addTo(map);
    casingRef.current = casing;
    layerRef.current = layer;
    return () => {
      layer.editing?.disable(); layer.remove(); casing.remove();
      if (layerRef.current === layer) layerRef.current = null;
      if (casingRef.current === casing) casingRef.current = null;
    };
  }, [map, selKey, hasSelection]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Hide outline": take the outline off the map to compare with the roof underneath.
  useEffect(() => {
    const layer = layerRef.current, casing = casingRef.current;
    if (!map || !layer || !casing) return;
    if (hidden) { setEditTool("none"); layer.remove(); casing.remove(); }
    else if (!map.hasLayer(layer)) { casing.addTo(map); layer.addTo(map); }
  }, [map, hidden, selKey]);

  // "Move outline": drag anywhere inside the outline to shift the whole shape.
  useEffect(() => {
    const layer = layerRef.current;
    if (!map || editTool !== "move" || !layer) return;
    const el = map.getContainer();
    el.classList.add("roof-moving");
    let start: L.LatLng | null = null; let orig: L.LatLng[] = []; let pointer = -1;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if ((e.target as HTMLElement).closest(".leaflet-control")) return;
      const ll = map.mouseEventToLatLng(e);
      if (!booleanPointInPolygon([ll.lng, ll.lat], layer.toGeoJSON() as Feature<GPolygon>)) return;
      e.stopPropagation(); e.preventDefault();
      map.dragging.disable();
      start = ll; pointer = e.pointerId;
      orig = (layer.getLatLngs()[0] as L.LatLng[]).map((p) => L.latLng(p.lat, p.lng));
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== pointer) return;
      const ll = map.mouseEventToLatLng(e);
      const dLat = ll.lat - start.lat, dLng = ll.lng - start.lng;
      layer.setLatLngs(orig.map((p) => [p.lat + dLat, p.lng + dLng] as [number, number]));
      sync();
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== pointer) return;
      start = null; map.dragging.enable(); sync();
    };
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.classList.remove("roof-moving");
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      map.dragging.enable();
    };
  }, [map, editTool, selKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Edit corners": drag the corner handles; the panel follows every drag.
  useEffect(() => {
    const layer = layerRef.current;
    if (!map || !drawReady || editTool !== "corners" || !layer) return;
    const Poly = (L as unknown as { Edit?: { Poly?: new (p: L.Polygon) => { enable(): void; disable(): void } } }).Edit?.Poly;
    // Rebuild the handles each time: "Move outline" replaces the corner list they'd otherwise point at.
    layer.editing?.disable();
    if (Poly) layer.editing = new Poly(layer);
    if (!layer.editing) return;
    const editing = layer.editing;
    editing.enable();
    // Right-click a corner to delete it (a plain click does the same; midpoints add corners when dragged).
    const onContext = (e: L.LeafletEvent) => {
      const m = (e as L.LeafletEvent & { marker?: L.Marker }).marker;
      // A corner's click handler is leaflet-draw's own delete-vertex action.
      if (m) m.fire("click");
    };
    const ctxEvent = (L as unknown as { Draw: { Event: { MARKERCONTEXT: string } } }).Draw.Event.MARKERCONTEXT;
    map.on(ctxEvent, onContext);
    layer.on("editdrag edit", sync);
    return () => { map.off(ctxEvent, onContext); layer.off("editdrag edit", sync); editing.disable(); sync(); };
  }, [map, drawReady, editTool, selKey, editRev]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fit the whole outline in the map area the controls and panel leave free.
  const fitOutline = (ring: LL[]) => {
    if (!map) return;
    requestAnimationFrame(() => {
      const box = map.getContainer().getBoundingClientRect();
      const controls = controlsRef.current?.getBoundingClientRect();
      const panel = document.querySelector(".roof-panel")?.getBoundingClientRect();
      const side = panel && panel.left > box.left + box.width / 2; // desktop: panel on the right
      const top = Math.max(16, (controls?.bottom ?? box.top) - box.top + 12);
      const right = side && panel ? box.right - panel.left + 16 : 16;
      const bottom = !side && panel ? box.bottom - panel.top + 12 : 16;
      map.flyToBounds(L.latLngBounds(ring), {
        paddingTopLeft: [16, top],
        paddingBottomRight: [right, bottom],
        maxZoom: 21,
        duration: 0.8,
      });
    });
  };

  // The sample is a fixed hand-traced outline, shown exactly as given. Without one,
  // fall back to the building at the sample spot (with the building shift applied).
  const [sampleBusy, setSampleBusy] = useState(false);
  const sample = async () => {
    if (!map || sampleBusy) return;
    if (SAMPLE_ROOF_POLYGON.length >= 3) {
      const f = sampleRoofFeature();
      pick(f); fitOutline(toLatLngs(f));
      return;
    }
    const c = SAMPLE_ROOF_CENTER, pad = 0.0006;
    setSampleBusy(true);
    let found: Feature<GPolygon> | null = null;
    try {
      const feats = await loadBuildingsIn({ getSouth: () => c.lat - pad, getNorth: () => c.lat + pad, getWest: () => c.lng - pad, getEast: () => c.lng + pad });
      found = pickRoofAt(feats.map((f) => shiftFeature(f, offsetRef.current)), c, 0);
    } catch { /* shown below */ }
    setSampleBusy(false);
    if (!found) { toast(tx(SAMPLE_FAILED)); map.flyTo([c.lat, c.lng], SAMPLE_ROOF_ZOOM); return; }
    pick(found); fitOutline(toLatLngs(found));
  };

  const copyOutline = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(outlineCoords(selected)));
      toast(tx("Copied"));
    } catch { toast(tx("Couldn't copy to the clipboard")); }
  };

  const selectedId = selected ? String(selected.properties?.["id"]) : null;
  const toolBtn = (t: Exclude<EditTool, "none">) => ({
    onClick: () => setEditTool((cur) => (cur === t ? "none" : t)),
    variant: editTool === t ? ("default" as const) : ("outline" as const),
    "aria-pressed": editTool === t,
    size: "sm" as const,
    className: editTool === t ? "px-2.5" : "bg-card px-2.5",
  });

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
        <BuildingsLayer active={mode === "tap"} data={data} selectedId={selectedId} onData={setData} onStatus={setStatus} retryKey={retryKey} offset={offset} />
      </MapContainer>

      <div ref={controlsRef} className="absolute inset-x-3 top-3 z-[1000] flex flex-col gap-2 md:left-4 md:right-auto md:w-96">
        <div className="flex items-start gap-2">
          <SearchBox map={map} onSearch={() => setMode("none")} />
          <LanguageSwitcher className="h-11 md:h-10" />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => toggle("draw")} disabled={!drawReady} variant={mode === "draw" ? "default" : "outline"} aria-pressed={mode === "draw"} className={mode === "draw" ? "px-3" : "bg-card px-3"}>{tx("Draw my roof")}</Button>
          <Button onClick={sample} disabled={sampleBusy} variant="outline" className="bg-card px-3">{sampleBusy && <Loader2 className="animate-spin" />}{tx("Try a sample roof")}</Button>
          <Button onClick={() => toggle("tap")} variant={mode === "tap" ? "default" : "outline"} aria-pressed={mode === "tap"} className={mode === "tap" ? "px-3" : "bg-card px-3"}><MousePointerClick />{tx("Tap a building")}</Button>
        </div>
        {selected && mode === "none" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button {...toolBtn("move")} disabled={hidden}><Move />{tx("Move outline")}</Button>
            <Button {...toolBtn("corners")} disabled={!drawReady || hidden}><Spline />{tx("Edit corners")}</Button>
            <Button onClick={resetOutline} disabled={hidden} size="sm" variant="outline" className="bg-card px-2.5"><RotateCcw />{tx("Reset outline")}</Button>
            <Button onClick={() => setHidden((h) => !h)} aria-pressed={hidden} size="sm" variant="outline" className="bg-card px-2.5" aria-label={tx(hidden ? "Show outline" : "Hide outline")} title={tx(hidden ? "Show outline" : "Hide outline")}>{hidden ? <EyeOff /> : <Eye />}{tx(hidden ? "Show outline" : "Hide outline")}</Button>
            {dev && <Button onClick={copyOutline} size="sm" variant="outline" className="bg-card px-2.5"><Copy />Copy outline coordinates</Button>}
            {editTool !== "none" && (
              <p className="w-fit rounded-md bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">
                {tx(editTool === "move" ? "Drag the outline onto your roof" : "Drag corners to fit. Drag a midpoint to add one; right-click a corner to delete it")}
              </p>
            )}
          </div>
        )}
        {mode === "tap" && <p className="w-fit rounded-md bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">{tx(tapBusy ? "Finding building…" : "Tap a building to select its roof")}</p>}
        {mode === "tap" && status.loading && <p className="pointer-events-none flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm"><Loader2 className="size-3 animate-spin" />{tx("Loading buildings...")}</p>}
        {mode === "tap" && status.error && (
          <div className="flex w-fit items-center gap-2 rounded-md bg-card px-2 py-1 text-xs shadow-sm">
            <span className="text-destructive">{tx(status.error)}</span>
            <Button onClick={() => setRetryKey((k) => k + 1)} size="sm" className="h-6 px-2">{tx("Retry")}</Button>
            <Button onClick={() => setStatus({ loading: false, error: null })} size="icon" variant="ghost" className="size-6" aria-label={tx("Dismiss")}><X /></Button>
          </div>
        )}
        {mode === "tap" && map && !status.loading && !status.error && !data && <p className="w-fit rounded-md bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">{tx("Zoom in to see buildings")}</p>}
      </div>

      {dev && (
        <div className="absolute bottom-3 left-14 z-[1000] flex flex-col gap-1.5 rounded-md border border-border bg-card p-2 text-xs shadow-sm">
          <span className="font-semibold text-foreground">Building outline shift</span>
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Shift building outlines" className="grid grid-cols-3 gap-0.5">
              <span />
              <RepeatButton onRepeat={() => calibrate(0, CALIBRATE_M)} variant="outline" size="icon" className="size-7" aria-label="Shift outlines north">N</RepeatButton>
              <span />
              <RepeatButton onRepeat={() => calibrate(-CALIBRATE_M, 0)} variant="outline" size="icon" className="size-7" aria-label="Shift outlines west">W</RepeatButton>
              <RepeatButton onRepeat={() => calibrate(0, -CALIBRATE_M)} variant="outline" size="icon" className="size-7" aria-label="Shift outlines south">S</RepeatButton>
              <RepeatButton onRepeat={() => calibrate(CALIBRATE_M, 0)} variant="outline" size="icon" className="size-7" aria-label="Shift outlines east">E</RepeatButton>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-muted-foreground" aria-live="polite">East {offset.east.toFixed(1)} m, North {offset.north.toFixed(1)} m</span>
              <div className="flex gap-1">
                <Button onClick={copyOffset} size="sm" variant="outline" className="h-6 px-2 text-xs"><Copy />Copy offset</Button>
                <Button onClick={resetOffset} size="sm" variant="ghost" className="h-6 px-2 text-xs">Reset</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && <RoofPanel roof={selected} onClose={clear} />}
    </div>
  );
}
