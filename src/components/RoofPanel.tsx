import type { Feature, Polygon } from "geojson";
import { roofStats } from "@/lib/roof";

export function RoofPanel({ roof, onClose }: { roof: Feature<Polygon>; onClose: () => void }) {
  const s = roofStats(roof);
  const fmt = (n: number) => Math.round(n).toLocaleString();
  return (
    <aside className="fixed inset-x-0 bottom-0 z-[1000] rounded-t-2xl border border-border bg-card p-5 shadow-lg md:inset-x-auto md:bottom-auto md:right-4 md:top-20 md:w-80 md:rounded-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Selected roof</h2>
        <button onClick={onClose} aria-label="Close" className="rounded-md px-2 text-xl text-muted-foreground hover:bg-muted">×</button>
      </div>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Roof area</dt><dd className="font-semibold">{fmt(s.area)} m²</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Usable area <span className="text-xs">(estimated)</span></dt><dd className="font-semibold text-primary">{fmt(s.usable)} m²</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Centroid</dt><dd className="font-mono text-xs">{s.lat.toFixed(5)}, {s.lon.toFixed(5)}</dd></div>
      </dl>
    </aside>
  );
}
