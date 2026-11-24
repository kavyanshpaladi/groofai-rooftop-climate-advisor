import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Feature, Polygon } from "geojson";
import { roofStats } from "@/lib/roof";
import { fetchClimate, type Climate } from "@/lib/climate";
import { saveReport } from "@/lib/report";
import { Questionnaire, isComplete, type Draft } from "./Questionnaire";

export function RoofPanel({ roof, onClose }: { roof: Feature<Polygon>; onClose: () => void }) {
  const s = roofStats(roof);
  const fmt = (n: number) => Math.round(n).toLocaleString();
  const [climate, setClimate] = useState<Climate | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    setClimate(null);
    fetchClimate(s.lat, s.lon).then((c) => live && setClimate(c));
    return () => { live = false; };
  }, [s.lat, s.lon]);

  const ready = climate && isComplete(draft);
  const go = () => {
    if (!climate || !isComplete(draft)) return;
    saveReport({ area: s.area, usable: s.usable, lat: s.lat, lon: s.lon, climate, answers: { roofType: draft.roofType, shade: draft.shade, access: draft.access, priority: draft.priority, budget: draft.budget } });
    navigate({ to: "/results" });
  };

  return (
    <aside className="roof-panel fixed inset-x-0 bottom-0 z-[1000] max-h-[70dvh] overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-lg md:inset-x-auto md:bottom-4 md:right-4 md:top-20 md:max-h-none md:w-80 md:rounded-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Selected roof</h2>
        <Button onClick={onClose} aria-label="Close" title="Close" variant="ghost" size="icon" className="text-muted-foreground"><X /></Button>
      </div>
      <dl className="space-y-2 text-sm">
        <Row label="Roof area" value={`${fmt(s.area)} m²`} />
        <Row label={<>Usable area <span className="text-xs">(estimated)</span></>} value={`${fmt(s.usable)} m²`} accent />
        <Row label="Centroid" value={<span className="font-mono text-xs">{s.lat.toFixed(5)}, {s.lon.toFixed(5)}</span>} />
      </dl>

      <h3 className="mb-2 mt-5 text-sm font-semibold text-foreground">Local climate</h3>
      {!climate ? (
        <p className="text-xs text-muted-foreground">Loading climate data…</p>
      ) : (
        <dl className="space-y-2 text-sm">
          <Row label="Solar irradiance" value={`${climate.irradiance.toFixed(2)} kWh/m²/day`} />
          <Row label="Avg max temperature" value={`${climate.maxTemp.toFixed(1)} °C`} />
          <Row label="Annual rainfall" value={`${fmt(climate.rainfall)} mm`} />
          {climate.fallback && <p className="text-xs text-muted-foreground">Couldn't reach NASA POWER, so typical values are shown.</p>}
        </dl>
      )}

      <h3 className="mb-2 mt-5 text-sm font-semibold text-foreground">About your roof</h3>
      <Questionnaire value={draft} onChange={setDraft} />
      <Button onClick={go} disabled={!ready} className="mt-5 h-10 w-full">
        See results
      </Button>
      {!ready && <p className="mt-2 text-center text-xs text-muted-foreground">Answer all questions to continue</p>}
    </aside>
  );
}

function Row({ label, value, accent }: { label: React.ReactNode; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-semibold ${accent ? "text-primary" : ""}`}>{value}</dd>
    </div>
  );
}
