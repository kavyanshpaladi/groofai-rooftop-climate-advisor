import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Link } from "@tanstack/react-router";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import type { OptionId } from "@/lib/scoring";
import { MAX_DRAWN_PANELS, coveragePct, ringArea, validRing, type LL, type PanelLayout } from "@/lib/panels";
import { themeColor } from "@/lib/map-colors";
import { formatNum } from "@/lib/format";
import { MIN_ROOF_AREA } from "@/lib/roof";

const TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABEL: Record<OptionId, string> = {
  solar: "Solar panels",
  green: "Green roof",
  reflective: "Cool roof",
  rainwater: "Rainwater harvesting",
  hybrid: "Hybrid roof",
};
const MAP_OPTS: Leaflet.MapOptions = {
  zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
  boxZoom: false, keyboard: false, touchZoom: false, inertia: false, zoomSnap: 0.25, zoomAnimation: false, fadeAnimation: false,
};
const DROP_SVG = (fill: string) =>
  `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2.7s-7 7.6-7 12.3a7 7 0 0 0 14 0c0-4.7-7-12.3-7-12.3z" fill="${fill}" stroke="white" stroke-width="2"/></svg>`;

type Maps = { L: typeof Leaflet; before: Leaflet.Map; after: Leaflet.Map; gBefore: Leaflet.LayerGroup; gAfter: Leaflet.LayerGroup; canvas: Leaflet.Canvas };
/** Above this many panels they are drawn on a canvas so the preview stays fast. */
const CANVAS_FROM = 400;
/** Inner cell lines are skipped when a panel is narrower than this on screen. */
const CELL_LINES_MIN_PX = 8;
type Status = "loading" | "ready" | "error";

/**
 * Before/after roof preview: two locked satellite maps of the same roof, the "after" one
 * showing the recommended upgrade (real panel layout for solar), revealed by a slider.
 */
export type Coverage = { pct: number; edited: boolean; overBudget: boolean; onChange: (pct: number) => number; onReset: () => void };

/** Small number field for the roof-coverage percent; commits 300 ms after the last change and then shows the percent actually reached. */
function CoverageField({ pct, onCommit }: { pct: number; onCommit: (pct: number) => number }) {
  const [text, setText] = useState(String(pct));
  const timer = useRef(0);
  const live = useRef({ pct, onCommit });
  live.current = { pct, onCommit };
  useEffect(() => { window.clearTimeout(timer.current); setText(String(pct)); }, [pct]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const commit = (raw: string) => {
    window.clearTimeout(timer.current);
    const n = Number(raw);
    // Empty or not a number: keep the current value. 0 and below → 1, above 100 → 100.
    if (raw.trim() === "" || !Number.isFinite(n)) { setText(String(live.current.pct)); return; }
    setText(String(live.current.onCommit(Math.max(1, Math.min(100, Math.round(n))))));
  };
  return (
    <input
      type="number" min={1} max={100} step={1} inputMode="numeric" aria-label="Share of usable roof covered by panels, in percent"
      value={text}
      onChange={(e) => { const v = e.target.value; setText(v); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => commit(v), 300); }}
      onBlur={(e) => { if (e.target.value !== String(live.current.pct)) commit(e.target.value); }}
      className="coverage-input mx-1 w-14 rounded-md border-2 border-primary/60 bg-background py-0.5 pl-1.5 pr-0.5 text-right text-sm font-semibold text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

export function BeforeAfter({ option, outline, layout: fullLayout, usable, coverage }: { option: OptionId; outline: LL[] | undefined; layout: PanelLayout | null; usable: number; coverage?: Coverage }) {
  // The outline arrives already settled (300 ms) together with its panel layout.
  const ring = outline;
  const valid = validRing(ring);
  const tooSmall = valid && ringArea(ring) < MIN_ROOF_AREA;
  const usesPanels = option === "solar" || option === "hybrid";
  const layout = usesPanels ? fullLayout : null;

  const boxRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<Maps | null>(null);
  const ringRef = useRef(ring);
  ringRef.current = ring;
  const [mapsRev, setMapsRev] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [retry, setRetry] = useState(0);
  const [pos, setPos] = useState(50);
  const patternId = `ba-dots-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const canShow = valid && !tooSmall;

  const fit = () => {
    const m = mapsRef.current, r = ringRef.current;
    if (!m || !validRing(r)) return;
    const b = m.L.latLngBounds(r).pad(0.2);
    for (const map of [m.before, m.after]) { map.invalidateSize(); map.fitBounds(b, { maxZoom: 20, animate: false }); }
  };

  // Create both maps once the box has a real size; rebuild on Retry.
  useEffect(() => {
    if (!canShow) return;
    const box = boxRef.current;
    if (!box) return;
    let cancelled = false, creating = false, timer = 0;
    setStatus("loading");

    const create = async () => {
      creating = true;
      const L = (await import("leaflet")).default;
      if (cancelled || !beforeRef.current || !afterRef.current) return;
      const before = L.map(beforeRef.current, MAP_OPTS);
      const after = L.map(afterRef.current, MAP_OPTS);
      const stats = { done: 0, loads: 0, errors: 0 };
      for (const map of [before, after]) {
        const t = L.tileLayer(TILES, { maxNativeZoom: 19, maxZoom: 21 });
        t.on("tileload", () => { stats.loads++; });
        t.on("tileerror", () => { stats.errors++; });
        t.once("load", () => {
          if (cancelled) return;
          stats.done++;
          if (stats.done < 2) return;
          window.clearTimeout(timer);
          setStatus(stats.errors > stats.loads ? "error" : "ready");
        });
        t.addTo(map);
      }
      mapsRef.current = { L, before, after, gBefore: L.layerGroup().addTo(before), gAfter: L.layerGroup().addTo(after), canvas: L.canvas({ padding: 0.2 }) };
      fit();
      timer = window.setTimeout(() => { if (!cancelled) setStatus((s) => (s === "loading" ? "error" : s)); }, 20000);
      setMapsRev((n) => n + 1);
    };

    const ro = new ResizeObserver(() => {
      if (!box.clientWidth || !box.clientHeight) return;
      if (!creating) void create();
      else fit();
    });
    ro.observe(box);
    return () => {
      cancelled = true;
      ro.disconnect();
      window.clearTimeout(timer);
      const m = mapsRef.current;
      mapsRef.current = null;
      m?.before.remove();
      m?.after.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShow, retry]);

  // Draw the outline and the upgrade whenever the roof, solution or panel layout changes.
  useEffect(() => {
    const m = mapsRef.current;
    if (!m || !validRing(ring)) return;
    const { L, gBefore, gAfter } = m;
    gBefore.clearLayers();
    gAfter.clearLayers();
    fit();
    const orange = themeColor("--roof-selection", "#f97316");
    const outline = { color: orange, weight: 2, opacity: 1, smoothFactor: 0, interactive: false };
    L.polygon(ring, { ...outline, fillColor: orange, fillOpacity: 0.15 }).addTo(gBefore);

    const fill = (color: string, opacity: number) =>
      L.polygon(ring, { stroke: false, fillColor: color, fillOpacity: opacity, smoothFactor: 0, interactive: false }).addTo(gAfter);

    if (option === "green" || option === "hybrid") {
      fill(themeColor("--vegetation", "#22c55e"), 0.55);
      const dots = fill("#ffffff", 1);
      const path = (dots as unknown as { _path?: SVGPathElement })._path;
      const svg = path?.ownerSVGElement;
      if (path && svg) {
        if (!svg.querySelector(`#${patternId}`)) {
          const ns = "http://www.w3.org/2000/svg";
          const defs = svg.querySelector("defs") ?? svg.insertBefore(document.createElementNS(ns, "defs"), svg.firstChild);
          const pat = document.createElementNS(ns, "pattern");
          pat.setAttribute("id", patternId);
          pat.setAttribute("width", "7");
          pat.setAttribute("height", "7");
          pat.setAttribute("patternUnits", "userSpaceOnUse");
          pat.innerHTML = `<circle cx="2" cy="2" r="1.1" fill="#14532d" fill-opacity="0.45"/><circle cx="5.5" cy="5.5" r="0.9" fill="#bbf7d0" fill-opacity="0.5"/>`;
          defs.appendChild(pat);
        }
        path.setAttribute("fill", `url(#${patternId})`);
      }
    } else if (option === "reflective") {
      fill(themeColor("--cool-roof", "#e0f2fe"), 0.6);
    } else if (option === "rainwater") {
      const water = themeColor("--water", "#3b82f6");
      fill(water, 0.4);
      // No height data, so the drain sits at the corner lowest on the map.
      const low = ring.reduce((a, b) => (b[0] < a[0] ? b : a));
      L.marker(low, { interactive: false, keyboard: false, icon: L.divIcon({ className: "", html: DROP_SVG(water), iconSize: [22, 22], iconAnchor: [11, 20] }) }).addTo(gAfter);
    } else if (option !== "solar") {
      fill(themeColor("--primary", "#16a34a"), 0.4);
    }

    if (layout && layout.count > 0) {
      const fillC = themeColor("--panel-fill", "#1e3a8a"), edge = themeColor("--panel-edge", "#93c5fd");
      const shown = layout.panels.slice(0, MAX_DRAWN_PANELS);
      const draw = shown.length > CANVAS_FROM ? { renderer: m.canvas } : {};
      const group = L.layerGroup().addTo(gAfter);
      const at = (u: LL, v: LL, t: number): LL => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
      // Cell lines only when a panel is big enough on screen to show them.
      const first = shown[0] as [LL, LL, LL, LL];
      const px = (u: LL, v: LL) => m.after.latLngToContainerPoint(u).distanceTo(m.after.latLngToContainerPoint(v));
      const cells = Math.min(px(first[0], first[1]), px(first[0], first[3])) >= CELL_LINES_MIN_PX;
      for (const p of shown) {
        L.polygon(p, { ...draw, color: edge, weight: 1, fillColor: fillC, fillOpacity: 0.9, smoothFactor: 0, interactive: false }).addTo(group);
        if (!cells) continue;
        const [a, b, c, d] = p as [LL, LL, LL, LL];
        // 2 × 3 cells: 3 along the panel's long side, 2 along its short side.
        const lines: [LL, LL][] = layout.portrait
          ? [[at(a, d, 1 / 3), at(b, c, 1 / 3)], [at(a, d, 2 / 3), at(b, c, 2 / 3)], [at(a, b, 0.5), at(d, c, 0.5)]]
          : [[at(a, b, 1 / 3), at(d, c, 1 / 3)], [at(a, b, 2 / 3), at(d, c, 2 / 3)], [at(a, d, 0.5), at(b, c, 0.5)]];
        L.polyline(lines, { ...draw, color: edge, weight: 0.5, opacity: 0.6, smoothFactor: 0, interactive: false }).addTo(group);
      }
    }
    L.polygon(ring, { ...outline, fill: false }).addTo(gAfter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsRev, ring, option, layout]);

  // One-time hint: nudge the handle so people notice it can be dragged.
  const hinted = useRef(false);
  const hintRaf = useRef(0);
  useEffect(() => {
    if (status !== "ready" || hinted.current) return;
    hinted.current = true;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now(), D = 1000;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / D);
      setPos(50 - 15 * Math.sin(Math.PI * p));
      if (p < 1) hintRaf.current = requestAnimationFrame(tick);
    };
    hintRaf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(hintRaf.current);
  }, [status]);

  const stopHint = () => cancelAnimationFrame(hintRaf.current);
  const setFromX = (clientX: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r?.width) return;
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    stopHint();
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromX(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) setFromX(e.clientX);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = e.key === "ArrowLeft" ? pos - 5 : e.key === "ArrowRight" ? pos + 5 : e.key === "Home" ? 0 : e.key === "End" ? 100 : null;
    if (next === null) return;
    e.preventDefault();
    stopHint();
    setPos(Math.max(0, Math.min(100, next)));
  };

  const label = LABEL[option];
  const caption = usesPanels
    ? layout && layout.count > 0
      ? <>
          Panels cover about{coverage ? <CoverageField pct={coverage.pct} onCommit={coverage.onChange} /> : ` ${coveragePct(layout.count, usable)}`}% of your usable roof
          {layout.count > MAX_DRAWN_PANELS ? ` (showing first ${formatNum(MAX_DRAWN_PANELS)} panels)` : ""}
          {coverage?.overBudget && <span className="ml-2 text-xs font-semibold text-destructive">Above your budget</span>}
          {coverage?.edited && <button type="button" onClick={coverage.onReset} className="ml-2 text-xs font-medium text-primary underline underline-offset-2">Reset to budget default</button>}
        </>
      : "No room for full panels on this outline. Try adjusting the outline."
    : option === "green" ? "Planting shown across your roof outline"
    : option === "reflective" ? "Cool reflective coating shown across your roof outline"
    : option === "rainwater" ? "Rain collected from your roof, drained at the marked corner"
    : `${label} shown across your roof outline`;

  if (!canShow) {
    return (
      <div className="print:hidden">
        <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted p-4 text-center">
          <p className="font-semibold text-foreground">{tooSmall ? "Roof too small for a preview" : "Couldn't load the roof preview"}</p>
          {!tooSmall && (
            <>
              <p className="text-sm text-foreground/75">Select your roof on the map again to see it here.</p>
              <Button asChild variant="outline" size="sm"><Link to="/map">Back to map</Link></Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="print:hidden">
      <div
        ref={boxRef}
        role="slider"
        tabIndex={0}
        aria-label="Before and after comparison"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`${Math.round(pos)}% before, ${100 - Math.round(pos)}% after`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
        onKeyDown={onKeyDown}
        className="relative aspect-video cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-xl border border-border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div ref={beforeRef} className="ba-map absolute inset-0 isolate" />
        <div className="absolute inset-0 z-[1]" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          <div ref={afterRef} className="ba-map absolute inset-0 isolate" />
        </div>

        {status !== "ready" && (
          <div className={`absolute inset-0 z-[600] flex flex-col items-center justify-center gap-3 ${status === "loading" ? "ba-skeleton" : "bg-muted"}`}>
            {status === "error" && (
              <>
                <p className="font-semibold text-foreground">Couldn't load the roof preview</p>
                <Button variant="outline" size="sm" onPointerDown={(e) => e.stopPropagation()} onClick={() => setRetry((n) => n + 1)}>Retry</Button>
              </>
            )}
          </div>
        )}

        {layout && layout.count > 0 && status === "ready" && (
          <span className="pointer-events-none absolute bottom-3 right-3 z-[700] rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm">
            {formatNum(layout.count)} {layout.count === 1 ? "panel" : "panels"} · {layout.kw.toFixed(1)} kW
          </span>
        )}
        <span className="pointer-events-none absolute left-3 top-3 z-[700] rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm sm:text-sm">Before</span>
        <span className="pointer-events-none absolute right-3 top-3 z-[700] max-w-[60%] truncate rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm sm:text-sm">After: {label}</span>
        <div className="pointer-events-none absolute inset-y-0 z-[700] w-0.5 -translate-x-1/2 bg-card shadow" style={{ left: `${pos}%` }}>
          <div className="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-primary bg-card text-base font-bold text-primary shadow-lg">
            ‹ ›
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="text-sm text-foreground/80">{caption}</div>
        <p className="text-xs text-foreground/60">Imagery © Esri</p>
      </div>
    </div>
  );
}
