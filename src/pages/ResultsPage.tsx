import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { loadReport, type Report } from "@/lib/report";
import { scoreOptions, type OptionId } from "@/lib/scoring";
import { ASSUMPTION_LABELS, DEFAULT_ASSUMPTIONS, greenImpact, rainwaterImpact, reflectiveImpact, solarImpact, type Assumptions } from "@/lib/impact";
import { BeforeAfter } from "@/components/BeforeAfter";
import { logRoofReport } from "@/lib/roof-log";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const num = (n: number) => Math.round(n).toLocaleString("en-IN");
const CHECKLIST = ["Structure can carry the extra load", "Waterproofing is in good shape", "Drainage is clear and adequate", "Fire safety and safe access are planned", "Permissions from society or local authority"];

export function ResultsPage() {
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [a, setA] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  useEffect(() => setReport(loadReport()), []);

  const scores = useMemo(() => report && scoreOptions(report.answers, { usable: report.usable, ...report.climate }), [report]);

  useEffect(() => {
    if (!report || !scores?.length) return;
    try {
      const s = solarImpact(report.usable, report.climate.irradiance, DEFAULT_ASSUMPTIONS);
      const r = rainwaterImpact(report.usable, report.climate.rainfall, DEFAULT_ASSUMPTIONS);
      const g = greenImpact(report.usable, DEFAULT_ASSUMPTIONS);
      void logRoofReport(report, scores, { solarKw: s.kw, solarKwhYear: s.kwhYear, solarSavings: s.savings, solarCost: s.cost, rainLitresYear: r.litresYear, greenCo2: g.co2 });
    } catch {
      // never affect the page
    }
  }, [report, scores]);

  if (report === undefined) return null;
  if (!report || !scores) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16 text-center">
        <p className="text-muted-foreground">No roof selected yet.</p>
        <Button asChild className="mt-4"><Link to="/map">Find my roof</Link></Button>
      </main>
    );
  }

  const { usable, climate } = report;
  const best = scores[0];
  if (!best) return null;
  const rest = scores.slice(1);
  const solar = solarImpact(usable, climate.irradiance, a);
  const refl = reflectiveImpact(usable, a);
  const green = greenImpact(usable, a);
  const rain = rainwaterImpact(usable, climate.rainfall, a);
  const yearlyBill = report.answers.bill * 12;

  const impact: Record<OptionId, string[]> = {
    solar: [`${solar.kw.toFixed(1)} kW system`, `${num(solar.kwhYear)} kWh/yr`, `Saves ${inr(solar.savings)}/yr${yearlyBill > 0 ? ` (~${Math.min(100, Math.round((solar.savings / yearlyBill) * 100))}% of your bill)` : ""}`, `Costs ${inr(solar.cost)}`, `Payback ${isFinite(solar.payback) ? solar.payback.toFixed(1) : "—"} years`],
    reflective: [`Indoor temperature drop ${refl.dropMin}–${refl.dropMax} °C`, `Costs ${inr(refl.cost)}`],
    green: [`${num(green.area)} m² planted`, `Costs ${inr(green.cost)}`, `CO₂ offset ≈ ${num(green.co2)} kg/yr`],
    rainwater: [`${num(rain.litresYear)} litres/yr collected`],
    hybrid: [],
  };
  {
    const top = scores.filter((s) => s.id !== "hybrid").slice(0, 2);
    impact.hybrid = top.flatMap((t) => impact[t.id].slice(0, 2).map((x) => `${t.name}: ${x}`));
  }

  const positives = best.reasons.slice(0, 3);

  return (
    <main className="roof-results mx-auto max-w-3xl px-5 py-8 print:py-0">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">RoofWise</p>
          <h1 className="text-2xl font-bold text-foreground">Your rooftop report</h1>
          <p className="text-sm text-muted-foreground">Usable area {num(usable)} m² (estimated) · {report.lat.toFixed(4)}, {report.lon.toFixed(4)}</p>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="print:hidden">Print report</Button>
      </div>

      <section className="result-card rounded-2xl border-2 border-primary bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Best fit</p>
        <div className="mt-1 flex items-baseline justify-between">
          <h2 className="text-3xl font-bold text-foreground">{best.name}</h2>
          <span className="text-3xl font-bold text-primary">{best.score}<span className="text-base text-muted-foreground">/100</span></span>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">{positives.map((r) => <li key={r}>{r}</li>)}</ul>
        <ImpactList items={impact[best.id]} />
        <div className="mt-5"><BeforeAfter option={best.id} /></div>
      </section>

      <section className="mt-6 space-y-3">
        {rest.map((o, i) => (
          <div key={o.id} className="result-card rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold text-foreground">{i + 2}. {o.name}</h3>
              <span className="font-semibold text-primary">{o.score}/100</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted"><div className="score-bar h-full rounded-full bg-primary" style={{ width: `${o.score}%` }} /></div>
            <p className="mt-2 text-xs text-muted-foreground">{o.reasons.join(" ")}</p>
            <ImpactList items={impact[o.id]} />
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-foreground">Assumptions <span className="text-xs font-normal text-muted-foreground">(rough estimates — edit to update)</span></h2>
        <p className="mt-1 text-xs text-muted-foreground">Climate: {climate.irradiance.toFixed(2)} kWh/m²/day, {climate.maxTemp.toFixed(1)} °C max, {num(climate.rainfall)} mm/yr{climate.fallback ? " (typical values)" : " (NASA POWER)"}.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(Object.keys(a) as (keyof Assumptions)[]).map((k) => (
            <label key={k} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{ASSUMPTION_LABELS[k]}</span>
              <input type="number" step="any" value={a[k]} onChange={(e) => setA({ ...a, [k]: Number(e.target.value) || 0 })}
                className="w-24 rounded-md border border-input bg-background px-2 py-1 text-right" />
            </label>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-foreground">Before you install</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {CHECKLIST.map((c) => (
            <li key={c}><label className="flex items-center gap-2"><input type="checkbox" className="accent-primary" />{c}</label></li>
          ))}
        </ul>
      </section>

      <p className="mt-6 rounded-lg bg-muted p-3 text-sm text-foreground">Planning estimate, not an engineering approval. Have a qualified professional inspect your roof.</p>
      <Button asChild variant="link" className="mt-6 px-0 print:hidden"><Link to="/map">← Back to map</Link></Button>
      <p className="mt-2 text-xs text-muted-foreground print:hidden">Anonymous roof statistics are saved to improve this tool.</p>
    </main>
  );
}

function ImpactList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted-foreground">Impact (rough estimates)</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">{items.map((x) => <li key={x} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{x}</li>)}</ul>
    </div>
  );
}
