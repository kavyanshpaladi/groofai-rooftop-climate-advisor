import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Droplet, Info, Leaf, Printer, Thermometer, TreeDeciduous, type LucideIcon } from "lucide-react";
import { loadReport, type Report } from "@/lib/report";
import { BUDGET_LABELS, scoreOptions, type OptionId } from "@/lib/scoring";
import { DEFAULT_ASSUMPTIONS, PANEL_KW, co2Avoided, familyWaterDays, greenImpact, heatRisk, rainwaterImpact, BUDGET_LIMIT, recommendSolar, reflectiveImpact, stepPanels, solarForKw, solarImpact, solarProjection, type Assumptions, type HeatRisk } from "@/lib/impact";
import { formatInr, formatNum } from "@/lib/format";
import { SolarOutlook } from "@/components/SolarOutlook";
import { BeforeAfter } from "@/components/BeforeAfter";
import { SubsidyCard } from "@/components/SubsidyCard";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";
import { CountUp, Disclosure, RoughBadge, ScoreRing, SectionHeading, SectionNav, StatTile, StepperTile, Tween, useReveal, type NavItem, type TileStep } from "@/components/results/parts";
import { logRoofReport } from "@/lib/roof-log";
import { EMPTY_LAYOUT, coveragePct, panelsForCoverage, layoutPanelBlock, layoutPanels, ringArea, validRing, type LL, type PanelLayout } from "@/lib/panels";
import { MIN_ROOF_AREA } from "@/lib/roof";
import { cn } from "@/lib/utils";

const CHECKLIST: TKey[] = ["chk1", "chk2", "chk3", "chk4", "chk5"];
const OPTION_NAME: Record<OptionId, TKey> = { solar: "optSolar", green: "optGreen", reflective: "optReflective", rainwater: "optRainwater", hybrid: "optHybrid" };

type Tile = { label: string; value: React.ReactNode; step?: TileStep };
type Field = { label: string; unit: string; hint?: string };

const FIELDS: Record<keyof Assumptions, Field> = {
  panelCoverage: { label: "Share of usable area with panels", unit: "0–1" },
  m2PerKw: { label: "Roof area per kW", unit: "m²" },
  performance: { label: "System performance ratio", unit: "0–1" },
  costPerKw: { label: "Solar cost", unit: "₹/kW" },
  monthlyKwh: { label: "Typical home electricity use", unit: "kWh/mo" },
  degradationPct: { label: "Panel degradation per year", unit: "%" },
  reflectiveCostPerM2: { label: "Reflective coating cost", unit: "₹/m²" },
  greenCoverage: { label: "Share of usable area planted", unit: "0–1" },
  greenCostPerM2: { label: "Green roof cost", unit: "₹/m²" },
  co2PerM2: { label: "CO₂ offset", unit: "kg/m²/yr" },
  runoff: { label: "Rainwater collection efficiency", unit: "0–1" },
  litresPerPersonDay: { label: "Water use per person", unit: "L/day" },
  heatModerate: { label: "Heat risk: moderate from", unit: "°C" },
  heatHigh: { label: "Heat risk: high from", unit: "°C" },
  heatExtreme: { label: "Heat risk: extreme above", unit: "°C" },
  gridFactor: { label: "Grid emission factor (approx.)", unit: "kg CO₂/kWh" },
  co2PerTree: { label: "CO₂ absorbed per tree", unit: "kg/yr" },
  tariff: { label: "Electricity tariff", unit: "₹/kWh" },
  tariffIncreasePct: { label: "Tariff increase per year", unit: "%" },
  maintenancePct: { label: "Maintenance per year", unit: "% of cost" },
  subsidyPerKw: { label: "Subsidy per kW, first 2 kW", unit: "₹", hint: "Check the official PM Surya Ghar portal" },
  subsidyThirdKw: { label: "Subsidy for the third kW", unit: "₹" },
  loanInterestPct: { label: "Loan interest (%)", unit: "per yr" },
  loanYears: { label: "Loan years", unit: "yrs" },
};

const GROUPS: { title: string; keys: (keyof Assumptions)[] }[] = [
  { title: "Solar", keys: ["panelCoverage", "m2PerKw", "performance", "costPerKw", "monthlyKwh", "degradationPct"] },
  { title: "Reflective roof", keys: ["reflectiveCostPerM2"] },
  { title: "Green roof", keys: ["greenCoverage", "greenCostPerM2", "co2PerM2"] },
  { title: "Rainwater", keys: ["runoff", "litresPerPersonDay"] },
  { title: "Climate and heat", keys: ["heatModerate", "heatHigh", "heatExtreme", "gridFactor", "co2PerTree"] },
  { title: "Finance", keys: ["tariff", "tariffIncreasePct", "maintenancePct", "subsidyPerKw", "subsidyThirdKw", "loanInterestPct", "loanYears"] },
];

const HEAT_BADGE: Record<HeatRisk, string> = {
  Low: "bg-heat-low/15 text-heat-low border-heat-low/30",
  Moderate: "bg-heat-moderate/15 text-heat-moderate border-heat-moderate/30",
  High: "bg-heat-high/15 text-heat-high border-heat-high/30",
  Extreme: "bg-heat-extreme/15 text-heat-extreme border-heat-extreme/30",
};

export function ResultsPage() {
  const { t, tx } = useI18n();
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [a, setA] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  useEffect(() => setReport(loadReport()), []);

  const scores = useMemo(() => report && scoreOptions(report.answers, { usable: report.usable, ...report.climate }), [report]);

  // The roof outline settles for 300 ms before the panel layout (and every solar number) is redone.
  const outline = report?.outline;
  const outlineKey = JSON.stringify(outline ?? null);
  const [ring, setRing] = useState<LL[] | undefined>(undefined);
  useEffect(() => {
    if (ring === undefined) { setRing(outline); return; }
    const t = setTimeout(() => setRing(outline), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlineKey]);
  const layout = useMemo(() => panelLayoutFor(ring), [ring]);
  // Panel count = the budget default, or the count the visitor set through the coverage field; every solar number comes from it.
  const [manualPanels, setManualPanels] = useState<number | null>(null);
  const budget = report?.answers.budget;
  useEffect(() => setManualPanels(null), [budget]);
  const solarResult = useMemo(() => (report ? solarFor(report, layout, a, manualPanels) : null), [report, layout, a, manualPanels]);
  const previewLayout = useMemo(
    () => (ring && layout && solarResult ? layoutPanelBlock(ring, solarResult.panels, layout) : layout),
    [ring, layout, solarResult],
  );

  useEffect(() => {
    if (!report || !scores?.length) return;
    try {
      const { solar: s } = solarFor(report, panelLayoutFor(report.outline), DEFAULT_ASSUMPTIONS);
      const r = rainwaterImpact(report.usable, report.climate.rainfall, DEFAULT_ASSUMPTIONS);
      const g = greenImpact(report.usable, DEFAULT_ASSUMPTIONS);
      void logRoofReport(report, scores, { solarKw: s.kw, solarKwhYear: s.kwhYear, solarSavings: s.savings, solarCost: s.cost, rainLitresYear: r.litresYear, greenCo2: g.co2 });
    } catch {
      // never affect the page
    }
  }, [report, scores]);

  useReveal(report);

  const best = scores?.[0];
  const showOutlook = best?.id === "solar" || best?.id === "hybrid";
  const navItems = useMemo<NavItem[]>(() => [
    { id: "summary", label: tx("Summary") },
    { id: "options", label: tx("Options") },
    ...(showOutlook ? [{ id: "outlook", label: tx("25-year outlook") }] : []),
    { id: "environment", label: tx("Environment") },
    { id: "assumptions", label: tx("Assumptions") },
    { id: "checklist", label: tx("Checklist") },
  ], [showOutlook, tx]);

  if (report === undefined) return null;
  if (!report || !scores) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16 text-center">
        <p className="text-foreground/70">{tx("No roof selected yet.")}</p>
        <Button asChild className="mt-4"><Link to="/map">{t("heroCta")}</Link></Button>
      </main>
    );
  }
  if (!best) return null;

  const { usable, climate } = report;
  const plural = (n: number) => tx(n === 1 ? "{n} panel" : "{n} panels", { n: formatNum(n) });
  const years = (n: number) => tx("{n} years", { n: n.toFixed(1) });
  const optName = (id: OptionId) => t(OPTION_NAME[id]);
  // Scoring reasons are produced in English; the hybrid one names the two options it combines.
  const reason = (r: string) => {
    const m = /^Combines (.+) and (.+)\.$/.exec(r);
    return m ? tx("Combines {a} and {b}.", { a: tx(m[1] ?? ""), b: tx(m[2] ?? "") }) : tx(r);
  };
  const rest = scores.slice(1);
  const { solar, rec, panels } = solarResult!;
  const edited = panels !== rec.panels;
  const budgetCap = BUDGET_LIMIT[report.answers.budget] ?? Infinity;
  const coverage = {
    pct: coveragePct(panels, usable),
    edited,
    overBudget: solar.cost > budgetCap,
    // Returns the percent actually reached after rounding to whole panels.
    onChange: (pct: number) => {
      const cur = coveragePct(panels, usable);
      let n = panelsForCoverage(pct, usable, rec.roofPanels);
      // One step of the arrows always moves by at least one panel, even when a panel is more than 1% of the roof.
      if (n === panels && Math.abs(pct - cur) === 1) n = Math.max(1, Math.min(rec.roofPanels, panels + Math.sign(pct - cur)));
      setManualPanels(n === rec.panels ? null : n);
      return coveragePct(n, usable);
    },
    onReset: () => setManualPanels(null),
  };
  // The Cost tile's arrows move the same panel count by one panel, so the cost changes by one panel's price.
  const costStep: TileStep | undefined = rec.roofPanels >= 1 ? {
    onStep: (dir) => { const n = stepPanels(panels, dir, rec.roofPanels); setManualPanels(n === rec.panels ? null : n); },
    canUp: panels < rec.roofPanels,
    canDown: panels > 1,
    upLabel: tx("Raise cost by one solar panel"),
    downLabel: tx("Lower cost by one solar panel"),
    valueText: tx("{cost} for {panels}", { cost: formatInr(solar.cost), panels: plural(panels) }),
  } : undefined;
  const refl = reflectiveImpact(usable, a);
  const green = greenImpact(usable, a);
  const rain = rainwaterImpact(usable, climate.rainfall, a);
  const co2 = co2Avoided(solar.kwhYear, a);
  const waterDays = familyWaterDays(rain.litresYear, a);
  const heat = heatRisk(climate.maxTemp, a);
  const projection = showOutlook ? solarProjection(solar.kwhYear, solar.cost, a, solar.subsidy) : null;
  const payback = isFinite(solar.payback) ? years(solar.payback) : "—";

  const tiles: Record<OptionId, Tile[]> = {
    solar: [
      { label: tx("System size"), value: <Tween value={solar.kw} format={(n) => `${n.toFixed(1)} kW`} /> },
      { label: tx("Yearly generation"), value: <Tween value={solar.kwhYear} format={(n) => `${formatNum(n)} kWh`} /> },
      { label: tx("Yearly savings"), value: <Tween value={solar.savings} format={formatInr} /> },
      { label: tx("Cost"), value: <Tween value={solar.cost} format={formatInr} />, ...(costStep ? { step: costStep } : {}) },
      { label: tx("Payback"), value: isFinite(solar.payback) ? <Tween value={solar.payback} format={years} /> : payback },
    ],
    reflective: [
      { label: tx("Indoor temperature drop"), value: `${refl.dropMin}–${refl.dropMax} °C` },
      { label: tx("Cost"), value: formatInr(refl.cost) },
    ],
    green: [
      { label: tx("Area planted"), value: `${formatNum(green.area)} m²` },
      { label: tx("Cost"), value: formatInr(green.cost) },
      { label: tx("CO₂ offset"), value: `≈ ${tx("{n} kg/yr", { n: formatNum(green.co2) })}` },
    ],
    rainwater: [
      { label: tx("Collected per year"), value: `${formatNum(rain.litresYear)} L` },
      { label: tx("Water for a family of 4"), value: tx("{n} days", { n: formatNum(waterDays) }) },
    ],
    hybrid: [],
  };
  tiles.hybrid = scores.filter((s) => s.id !== "hybrid").slice(0, 2)
    .flatMap((o) => tiles[o.id].slice(0, 2).map((x) => ({ label: `${optName(o.id)}: ${x.label}`, value: x.value })));

  const budgetLabel = report.answers.budget && report.answers.budget !== "unsure" ? tx(BUDGET_LABELS[report.answers.budget]) : null;
  const sizeVars = { panels: plural(rec.panels), kw: rec.kw.toFixed(1), max: plural(rec.roofPanels), need: rec.needKw.toFixed(1) };
  const solarNote = (
    <div className="mt-4 space-y-1 text-sm text-foreground/80">
      {rec.panels === 0 ? (
        <p>{tx(layout ? "No room for full panels on this outline. Try adjusting the outline." : "No room for full panels on this roof.")}</p>
      ) : (
        <>
          <p>
            {budgetLabel
              ? tx("At your {budget} budget we suggest {panels} ({kw} kW). Your roof fits up to {max}. A typical home needs about {need} kW.", { budget: budgetLabel, ...sizeVars })
              : tx("We suggest {panels} ({kw} kW). Your roof fits up to {max}. A typical home needs about {need} kW.", sizeVars)}
          </p>
          {edited && <p>{tx("You chose {panels} ({kw} kW).", { panels: plural(panels), kw: solar.kw.toFixed(1) })}</p>}
          {panels > rec.needPanels && <p>{tx("Larger than a typical home needs. Extra power may be exported to the grid.")}</p>}
          {panels < rec.needPanels && <p>{tx("Smaller than a typical home needs.")}</p>}
        </>
      )}
    </div>
  );

  return (
    <main className="roof-results overflow-x-clip bg-background">
      <div className="mx-auto max-w-[960px] px-4 pb-16 pt-8 sm:px-6 print:py-0">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">groofai</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{tx("Your rooftop report")}</h1>
            <p className="mt-2 text-sm text-foreground/75 sm:text-base">
              {tx("Usable area {area} m² (estimated)", { area: formatNum(usable) })} · {report.lat.toFixed(4)}, {report.lon.toFixed(4)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
            <LanguageSwitcher />
            <Button onClick={() => window.print()} variant="outline" className="shrink-0 print:hidden">
              <Printer /> <span className="hidden sm:inline">{tx("Print report")}</span><span className="sm:hidden">{tx("Print")}</span>
            </Button>
          </div>
        </header>

        <section id="summary" aria-label={tx("Summary")} className="rp-section mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <SummaryCard label={t("sumBestFit")} value={t(OPTION_NAME[best.id])} sub={<><CountUp value={best.score} format={(n) => String(Math.round(n))} />{t("sumScore")}</>} highlight />
          <SummaryCard label={t("sumSaves")} value={<CountUp value={solar.savings} format={formatInr} />} sub={t("sumWithSolar")} />
          <SummaryCard label={t("sumPayback")} value={isFinite(solar.payback) ? <><CountUp value={solar.payback} format={(n) => n.toFixed(1)} /> {t("sumYrs")}</> : "—"} sub={t("sumAfterSubsidy")} />
          <SummaryCard label={t("sumCo2")} value={<><CountUp value={co2.kg} format={formatNum} /> kg</>} sub={t("sumTrees", { n: formatNum(co2.trees) })} />
        </section>

        <div className="mt-6"><SectionNav items={navItems} /></div>

        <div className="mt-6 space-y-10">
          <section id="options" className="rp-section">
            <SectionHeading badge>{tx("Your options")}</SectionHeading>
            <article className="reveal rp-card rounded-2xl border-2 border-primary bg-card p-5 shadow-md sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <ScoreRing score={best.score} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("sumBestFit")}</p>
                  <h3 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">{optName(best.id)}</h3>
                  <ul className="mt-3 space-y-2">
                    {best.reasons.slice(0, 3).map((r) => (
                      <li key={r} className="flex items-start gap-2 text-sm text-foreground sm:text-base">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Check className="size-3.5" /></span>
                        {reason(r)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <TileGrid items={tiles[best.id]} className="mt-5" />
              {(best.id === "solar" || best.id === "hybrid") && solarNote}
              <div className="mt-5">
                <BeforeAfter option={best.id} outline={ring} layout={previewLayout} usable={usable} coverage={coverage} />
              </div>
            </article>

            {rest.length > 0 && (
              <div className="mt-4 space-y-3">
                <h3 className="text-base font-semibold text-foreground/80">{tx("Other options")}</h3>
                {rest.map((o, i) => {
                  const tiedWith = scores.slice(0, i + 1).find((s) => s.score === o.score);
                  return (
                    <Disclosure key={o.id} className="reveal" header={
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">{i + 2}</span>
                          <span className="font-semibold text-foreground">{optName(o.id)}</span>
                          {tiedWith && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{tx("Tied with {name}", { name: optName(tiedWith.id) })}</span>}
                          <span className="ml-auto text-sm font-semibold text-primary">{o.score}/100</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted"><div className="score-bar h-full rounded-full bg-primary" style={{ width: `${o.score}%` }} /></div>
                        <p className="mt-2 text-sm text-foreground/75">{o.reasons.map(reason).join(" ")}</p>
                      </>
                    }>
                      <TileGrid items={tiles[o.id]} />
                      {o.id === "solar" && solarNote}
                    </Disclosure>
                  );
                })}
              </div>
            )}
          </section>

          {rec.roofPanels >= 1 && (
            <SubsidyCard id="subsidy" panels={panels} maxPanels={rec.roofPanels} edited={edited} solar={solar} assumptions={a}
              onPanels={(n) => setManualPanels(n === rec.panels ? null : n)} onReset={() => setManualPanels(null)} />
          )}

          {projection && <SolarOutlook projection={projection} id="outlook" />}

          <section id="environment" className="rp-section">
            <SectionHeading badge>{tx("Environment and water")}</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <EnvCard icon={Leaf} label={tx("CO₂ avoided by solar")} value={tx("{n} kg/yr", { n: formatNum(co2.kg) })} hint={tx("≈ {n} trees' yearly absorption", { n: formatNum(co2.trees) })} />
              <EnvCard icon={Droplet} label={tx("Rainwater collected")} value={tx("{n} litres/yr", { n: formatNum(rain.litresYear) })} hint={tx("= {n} days of water for a family of 4", { n: formatNum(waterDays) })} />
              <EnvCard icon={Thermometer} label={tx("Heat risk")}
                value={<span className={cn("inline-flex rounded-full border px-3 py-0.5 text-base font-semibold", HEAT_BADGE[heat])}>{tx(heat)}</span>}
                hint={tx("Avg max temperature {t} °C", { t: climate.maxTemp.toFixed(1) })} />
              <EnvCard icon={TreeDeciduous} label={tx("Green roof CO₂ offset")} value={tx("{n} kg/yr", { n: formatNum(green.co2) })} hint={tx("{n} m² planted", { n: formatNum(green.area) })} />
            </div>
          </section>

          <section id="assumptions" className="rp-section">
            <Disclosure className="reveal" header={
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold text-foreground">{tx("Advanced: edit assumptions")}</span>
                <RoughBadge />
                <span className="w-full text-sm text-foreground/70">{tx("Change any value and every estimate above updates instantly.")}</span>
              </div>
            }>
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground/80">
                {tx("Climate: {irr} kWh/m²/day, {temp} °C max, {rain} mm/yr ({src}).", { irr: climate.irradiance.toFixed(2), temp: climate.maxTemp.toFixed(1), rain: formatNum(climate.rainfall), src: climate.fallback ? tx("typical values") : "NASA POWER" })}
              </p>
              <div className="mt-4 grid gap-x-8 gap-y-6 md:grid-cols-2">
                {GROUPS.map((g) => (
                  <fieldset key={g.title} className="min-w-0">
                    <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{tx(g.title)}</legend>
                    <div className="space-y-2">
                      {g.keys.map((k) => {
                        const f = FIELDS[k];
                        return (
                          <label key={k} className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 text-foreground/85">
                              {tx(f.label)}
                              {f.hint && <span className="block text-xs text-foreground/65">{tx(f.hint)}</span>}
                            </span>
                            <span className="flex shrink-0 items-center overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                              <input type="number" step="any" inputMode="decimal" value={a[k]} onChange={(e) => setA({ ...a, [k]: Number(e.target.value) || 0 })}
                                className="w-20 bg-transparent px-2 py-1.5 text-right text-sm text-foreground outline-none" />
                              <span className="border-l border-input bg-muted px-2 py-1.5 text-xs text-foreground/70">{tx(f.unit)}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </Disclosure>
          </section>

          <section id="checklist" className="rp-section">
            <div className="reveal rp-card rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <SectionHeading>{t("chkTitle")}</SectionHeading>
              <ul className="grid gap-2 sm:grid-cols-2">
                {CHECKLIST.map((c, i) => (
                  <li key={c}>
                    <label className="flex h-full min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 has-[:checked]:border-primary has-[:checked]:bg-primary/15 sm:text-base">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                      <span className="flex-1">{t(c)}</span>
                      <input type="checkbox" className="size-5 shrink-0 accent-primary" />
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rp-card mt-4 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-foreground sm:text-base">
              <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <p><strong>{t("chkNoteBold")}</strong> {t("chkNote")}</p>
            </div>
          </section>
        </div>

        <Button asChild variant="link" className="mt-8 px-0 print:hidden"><Link to="/map">{tx("← Back to map")}</Link></Button>
        <p className="mt-2 text-sm text-foreground/65 print:hidden">{tx("Anonymous roof statistics are saved to improve this tool.")}</p>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, sub, highlight = false }: { label: string; value: React.ReactNode; sub?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("rp-card rounded-2xl border bg-card p-4 shadow-sm sm:p-5", highlight ? "border-primary/50 bg-primary/5" : "border-border")}>
      <p className="text-xs font-medium uppercase tracking-wide text-foreground/70">{label}</p>
      <p className="mt-1.5 break-words text-xl font-bold leading-tight text-foreground sm:text-2xl">{value}</p>
      {sub && <p className="mt-1 text-sm text-foreground/70">{sub}</p>}
    </div>
  );
}

function TileGrid({ items, className }: { items: Tile[]; className?: string }) {
  if (!items.length) return null;
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {items.map((t) => t.step ? <StepperTile key={t.label} label={t.label} value={t.value} step={t.step} /> : <StatTile key={t.label} label={t.label} value={t.value} />)}
    </div>
  );
}

function EnvCard({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="reveal rp-card flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground/75">{label}</p>
        <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
        <p className="mt-1 text-sm text-foreground/70">{hint}</p>
      </div>
    </div>
  );
}

/** Solar system for a report: roof max from the panel layout (or an area estimate without an outline); panel count is the budget default unless set by hand. */
function solarFor(report: Report, layout: PanelLayout | null, a: Assumptions, manualPanels: number | null = null) {
  const irr = report.climate.irradiance;
  const roofMaxKw = layout ? layout.kw : solarImpact(report.usable, irr, a).roofMaxKw;
  const rec = recommendSolar(roofMaxKw, irr, report.answers.budget, a);
  const panels = manualPanels === null || rec.roofPanels === 0 ? rec.panels : Math.max(1, Math.min(rec.roofPanels, manualPanels));
  return { rec, panels, solar: { ...solarForKw(panels * PANEL_KW, irr, a), roofMaxKw } };
}

/** Panel layout for a saved outline; null for older reports without one (they fall back to an estimate). */
function panelLayoutFor(ring: LL[] | undefined): PanelLayout | null {
  if (!validRing(ring)) return null;
  return ringArea(ring) < MIN_ROOF_AREA ? EMPTY_LAYOUT : layoutPanels(ring);
}
