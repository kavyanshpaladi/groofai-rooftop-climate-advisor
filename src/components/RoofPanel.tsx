import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Feature, Polygon } from "geojson";
import { outlineCoords, roofStats } from "@/lib/roof";
import { fetchClimate, type Climate } from "@/lib/climate";
import { saveReport } from "@/lib/report";
import { useI18n } from "@/lib/i18n";
import { Questionnaire, isComplete, type Draft } from "./Questionnaire";

export function RoofPanel({ roof, onClose }: { roof: Feature<Polygon>; onClose: () => void }) {
  const { tx } = useI18n();
  const s = roofStats(roof);
  const fmt = (n: number) => Math.round(n).toLocaleString();
  const [climate, setClimate] = useState<Climate | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const navigate = useNavigate();

  // Climate data is regional, so nudging the outline doesn't refetch it; a new spot does (after a short pause).
  const cLat = Math.round(s.lat * 100) / 100, cLon = Math.round(s.lon * 100) / 100;
  useEffect(() => {
    let live = true;
    setClimate(null);
    const t = setTimeout(() => { fetchClimate(cLat, cLon).then((c) => live && setClimate(c)); }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [cLat, cLon]);

  const ready = climate && isComplete(draft);
  const go = () => {
    if (!climate || !isComplete(draft)) return;
    saveReport({ area: s.area, usable: s.usable, lat: s.lat, lon: s.lon, climate, outline: outlineCoords(roof), answers: { roofType: draft.roofType, shade: draft.shade, access: draft.access, priority: draft.priority, budget: draft.budget } });
    navigate({ to: "/results" });
  };

  return (
    <aside className="roof-panel fixed inset-x-0 bottom-0 z-[1000] max-h-[70dvh] overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-lg md:inset-x-auto md:bottom-4 md:right-4 md:top-20 md:max-h-none md:w-80 md:rounded-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{tx("Selected roof")}</h2>
        <Button onClick={onClose} aria-label={tx("Close")} title={tx("Close")} variant="ghost" size="icon" className="text-muted-foreground"><X /></Button>
      </div>
      <dl className="space-y-2 text-sm">
        <Row label={tx("Roof area")} value={`${fmt(s.area)} m²`} />
        <p className="text-xs text-muted-foreground">{tx("Outline from map data. Adjust it to match your roof for a better estimate.")}</p>
        <Row label={<>{tx("Usable area")} <span className="text-xs">{tx("(estimated)")}</span></>} value={`${fmt(s.usable)} m²`} accent />
        <Row label={tx("Centroid")} value={<span className="font-mono text-xs">{s.lat.toFixed(5)}, {s.lon.toFixed(5)}</span>} />
      </dl>

      <h3 className="mb-2 mt-5 text-sm font-semibold text-foreground">{tx("Local climate")}</h3>
      {!climate ? (
        <p className="text-xs text-muted-foreground">{tx("Loading climate data…")}</p>
      ) : (
        <dl className="space-y-2 text-sm">
          <Row label={tx("Solar irradiance")} value={`${climate.irradiance.toFixed(2)} kWh/m²/day`} />
          <Row label={tx("Avg max temperature")} value={`${climate.maxTemp.toFixed(1)} °C`} />
          <Row label={tx("Annual rainfall")} value={`${fmt(climate.rainfall)} mm`} />
          {climate.fallback && <p className="text-xs text-muted-foreground">{tx("Couldn't reach NASA POWER, so typical values are shown.")}</p>}
        </dl>
      )}

      <h3 className="mb-2 mt-5 text-sm font-semibold text-foreground">{tx("About your roof")}</h3>
      <Questionnaire value={draft} onChange={setDraft} />
      <Button onClick={go} disabled={!ready} className="mt-5 h-10 w-full">
        {tx("See results")}
      </Button>
      {!ready && <p className="mt-2 text-center text-xs text-muted-foreground">{tx("Answer all questions to continue")}</p>}
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
