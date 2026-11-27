import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Download, ReceiptText, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BillScanner } from "@/components/BillScanner";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { useAdvisorProgress } from "@/lib/advisor-progress";
import { type BillResult } from "@/lib/bill";
import { analyzeBill, BILL_HISTORY_KEY, historyEntry, readBillHistory, upsertHistory, type BillHistoryEntry, type BillRoof } from "@/lib/bill-analytics";
import { DEFAULT_ASSUMPTIONS } from "@/lib/impact";
import { loadReport } from "@/lib/report";
import { formatInr } from "@/lib/format";

export const Route = createFileRoute("/bill-analyzer")({
  head: () => ({ meta: [
    { title: "Bill Analyzer — groofai" },
    { name: "description", content: "Read your electricity bill and estimate solar savings, system size and carbon avoided using your own consumption." },
    { property: "og:title", content: "Bill Analyzer — groofai" },
    { property: "og:description", content: "Your electricity bill, solar savings estimates and private on-device usage history." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: BillAnalyzerPage,
});

function BillAnalyzerPage() {
  const { tx, lang } = useI18n();
  const { transfer } = useAdvisorProgress();
  const navigate = Route.useNavigate();
  const [bill, setBill] = useState<BillResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [roof, setRoof] = useState<BillRoof | null>(null);
  const [history, setHistory] = useState<BillHistoryEntry[]>([]);
  const [storageError, setStorageError] = useState(false);
  const recording = useRef(false);
  const recordedMonth = useRef<string | null>(null);
  useEffect(() => {
    setHistory(readBillHistory());
    const report = loadReport();
    if (report) setRoof({ usable: report.usable, irradiance: report.climate.irradiance });
  }, []);

  function record(next: BillResult) {
    const entry = historyEntry(next);
    if (!entry) return;
    const previousMonth = recordedMonth.current;
    recordedMonth.current = entry.month;
    setHistory((rows) => {
      const updated = upsertHistory(rows.filter((row) => previousMonth === null || row.month !== previousMonth), entry);
      try { localStorage.setItem(BILL_HISTORY_KEY, JSON.stringify(updated)); setStorageError(false); }
      catch { setStorageError(true); }
      return updated;
    });
  }
  function change(next: BillResult) {
    setBill(next);
    if (recording.current) record(next);
  }
  function clearHistory() {
    recording.current = false;
    recordedMonth.current = null;
    try { localStorage.removeItem(BILL_HISTORY_KEY); setHistory([]); setStorageError(false); }
    catch { setStorageError(true); }
  }
  const analysis = bill ? analyzeBill(bill, roof) : null;
  const num = (value: number) => new Intl.NumberFormat(lang === "en" ? "en-IN" : lang === "hi" ? "hi-IN" : "te-IN", { maximumFractionDigits: 2 }).format(value);
  const badge = <span className="rounded-full border border-sun/40 bg-sun/15 px-2.5 py-1 text-xs font-semibold text-foreground">{tx("Rough estimates")}</span>;

  return <main className="bill-analyzer min-h-dvh bg-background pb-24 text-foreground">
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <nav aria-label={tx("Main")} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-4 print:hidden">
        <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft />groofai</Link></Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="link" size="sm"><Link to="/advisor">{tx("AI Solar Advisor")}</Link></Button>
          <LanguageSwitcher />
        </div>
      </nav>
      <header className="py-8">
        <ReceiptText className="mb-3 size-7 text-primary" aria-hidden />
        <h1 className="text-3xl font-bold sm:text-4xl">{tx("Bill Analyzer")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{tx("Upload your electricity bill and see what solar could save you")}</p>
        <p className="mt-2 text-xs text-muted-foreground">{tx("Your bill photo is used only to read these numbers, and personal details are ignored.")}</p>
      </header>
      <section aria-label={tx("Scan my bill")} className="pb-6">
        <BillScanner key={scannerKey} bill={bill} onChange={change} onBusy={(value) => { setBusy(value); if (value) { recording.current = false; recordedMonth.current = null; } }}
          onScanned={(next) => { recording.current = true; record(next); }} />
      </section>
      <div aria-live="polite" aria-atomic="true">
        {bill && !analysis && <p className="mb-6 text-sm text-muted-foreground">{tx("Add units, amount and billing period to see solar estimates.")}</p>}
        {analysis && <>
          <section className="border-b border-border py-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{tx("Your bill at a glance")}</h2>{badge}</div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat label={tx("Monthly usage")} value={`${num(analysis.monthlyUnits)} kWh`} />
              <Stat label={tx("Current monthly bill")} value={formatInr(analysis.monthlyAmount)} />
              <Stat label={tx("Cost per unit (₹/kWh)")} value={`₹${num(analysis.tariff)}`} />
              <Stat label={tx("Daily average usage")} value={`${num(analysis.dailyUnits)} kWh`} />
              <Stat label={tx("Projected yearly bill")} value={formatInr(analysis.yearlyAmount)} />
            </div>
          </section>
          <section className="border-b border-border py-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{tx("Solar needed to cover your usage")}</h2>{badge}</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label={tx("System size")} value={`${num(analysis.solar.kw)} kW`} />
              <Stat label={tx("Bill with solar")} value={formatInr(analysis.newMonthlyAmount)} />
              <Stat label={tx("Monthly savings")} value={formatInr(analysis.monthlySavings)} />
              <Stat label={tx("Yearly savings")} value={formatInr(analysis.yearlySavings)} />
              <Stat label={tx("Cost after subsidy")} value={formatInr(analysis.solar.netCost)} />
              <Stat label={tx("Payback")} value={analysis.payback === null ? "—" : `${num(analysis.payback)} ${tx("yrs")}`} />
            </div>
            {analysis.solar.kw < analysis.demandKw && <p className="mt-3 text-sm text-muted-foreground">{tx("The selected roof limits the system size; it may not cover all your usage.")}</p>}
          </section>
          <section className="grid gap-8 border-b border-border py-6 sm:grid-cols-2">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{tx("Before vs after")}</h2>{badge}</div>
              <BillBars current={analysis.monthlyAmount} after={analysis.newMonthlyAmount} />
            </div>
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{tx("CO₂ avoided per year")}</h2>{badge}</div>
              <p className="text-4xl font-bold text-primary">{num(analysis.co2Kg)} <span className="text-lg font-medium">kg CO₂</span></p>
              <p className="mt-3 text-sm text-muted-foreground">{tx("Based on solar generation replacing grid electricity.")}</p>
            </div>
          </section>
          <details className="border-b border-border py-5">
            <summary className="flex cursor-pointer items-center justify-between gap-2 font-semibold focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-ring/50">{tx("How is this calculated?")}<ChevronDown className="size-4 shrink-0" /></summary>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>{tx("Monthly figures = bill figures × 30 ÷ billing days; yearly figures = monthly figures × 12.")}</li>
              <li>{tx("Tariff = bill amount ÷ billed units; daily usage = billed units ÷ billing days.")}</li>
              <li>{tx("Sunlight: {n} kWh/m²/day ({source}).", { n: num(analysis.irradiance), source: tx(roof ? "Selected roof" : "App default") })}</li>
              <li>{tx("Yearly solar generation = kW × sunlight × 365 × {performance} performance ratio.", { performance: DEFAULT_ASSUMPTIONS.performance })}</li>
              <li>{tx("Required kW = yearly usage ÷ yearly generation per kW. A selected roof caps size at usable area × {coverage} ÷ {area} m²/kW.", { coverage: DEFAULT_ASSUMPTIONS.panelCoverage, area: DEFAULT_ASSUMPTIONS.m2PerKw })}</li>
              <li>{tx("Savings = solar generation × your tariff, capped at your bill. New bill = current bill − savings.")}</li>
              <li>{tx("System cost = kW × ₹{cost}. Domestic subsidy: ₹{first}/kW for the first 2 kW, ₹{third} for the third kW; none beyond 3 kW. Other categories have no subsidy assumed.", { cost: DEFAULT_ASSUMPTIONS.costPerKw, first: DEFAULT_ASSUMPTIONS.subsidyPerKw, third: DEFAULT_ASSUMPTIONS.subsidyThirdKw })}</li>
              <li>{tx("Payback = cost after subsidy ÷ yearly savings. CO₂ = grid electricity replaced × {factor} kg/kWh.", { factor: DEFAULT_ASSUMPTIONS.gridFactor })}</li>
              <li>{tx("Assumes all estimated generation offsets your usage. Fixed charges, export rules, financing and maintenance are excluded; actual bills and eligibility vary.")}</li>
              <li>{tx("Check the official PM Surya Ghar portal")}</li>
            </ul>
          </details>
        </>}
      </div>
      <section className="py-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{tx("Usage trend")}</h2>
          {history.length > 0 && <Button variant="ghost" size="sm" className="print:hidden" onClick={clearHistory}><Trash2 />{tx("Clear my history")}</Button>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{tx("Only month, units and amount stay on this device. No bill photos or personal details are saved.")}</p>
        {history.length >= 2 ? <UsageBars rows={history} /> : <p className="mt-4 text-sm text-muted-foreground">{tx("Scan bills for two different months to see your usage trend.")}</p>}
        {bill && !historyEntry(bill) && <p className="mt-3 text-sm text-muted-foreground">{tx("To save this bill in history, add its units, amount and month (YYYY-MM).")}</p>}
        {storageError && <p role="status" className="mt-3 text-sm text-destructive">{tx("History storage is unavailable on this device.")}</p>}
      </section>
      {bill && <div className="flex flex-wrap gap-3 border-t border-border pt-6 print:hidden">
        <Button disabled={busy} onClick={() => { transfer(bill); void navigate({ to: "/advisor" }); }}>{tx("Use these in Solar Advisor")}<ArrowRight /></Button>
        <Button variant="outline" disabled={busy} onClick={() => { recording.current = false; recordedMonth.current = null; setBill(null); setScannerKey((key) => key + 1); }}><RotateCcw />{tx("Scan another bill")}</Button>
        <Button variant="outline" disabled={busy} onClick={() => window.print()}><Download />{tx("Download as PDF")}</Button>
      </div>}
    </div>
  </main>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <dl className="min-w-0 rounded-lg border border-border bg-card p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 break-words text-xl font-bold">{value}</dd></dl>;
}

function BillBars({ current, after }: { current: number; after: number }) {
  const { tx } = useI18n();
  const max = Math.max(current, after, 1);
  return <div className="space-y-4" role="img" aria-label={`${tx("Current monthly bill")}: ${formatInr(current)}; ${tx("Bill with solar")}: ${formatInr(after)}`}>
    {[{ label: tx("Current monthly bill"), value: current, color: "fill-sun" }, { label: tx("Bill with solar"), value: after, color: "fill-primary" }].map((row) => <div key={row.label}>
      <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm"><span>{row.label}</span><strong>{formatInr(row.value)}</strong></div>
      <svg viewBox="0 0 400 24" className="h-6 w-full" preserveAspectRatio="none" aria-hidden><rect width="400" height="24" rx="4" className="fill-muted" /><rect width={row.value / max * 400} height="24" rx="4" className={row.color} /></svg>
    </div>)}
  </div>;
}

function UsageBars({ rows }: { rows: BillHistoryEntry[] }) {
  const { tx, lang } = useI18n();
  const max = Math.max(...rows.map((row) => row.units), 1);
  const width = Math.max(320, rows.length * 90);
  const locale = lang === "en" ? "en-IN" : lang === "hi" ? "hi-IN" : "te-IN";
  return <div className="mt-5 overflow-x-auto">
    <svg viewBox={`0 0 ${width} 210`} width={width} height="210" className="max-w-none" role="img" aria-label={tx("Billed units by month")}>
      {rows.map((row, index) => {
        const x = (index + 0.5) * width / rows.length;
        const height = row.units / max * 140;
        const label = new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${row.month}-01T00:00:00Z`));
        return <g key={row.month}><title>{label}: {row.units} kWh, {formatInr(row.amount)}</title><rect x={x - 22} y={160 - height} width="44" height={height} rx="4" className="fill-rain" /><text x={x} y={150 - height} textAnchor="middle" className="fill-foreground text-xs">{row.units}</text><text x={x} y="184" textAnchor="middle" className="fill-muted-foreground text-xs">{label}</text></g>;
      })}
    </svg>
    <p className="text-xs text-muted-foreground">{tx("Billed units by month; billing periods may differ.")}</p>
    <table className="sr-only"><caption>{tx("Usage trend")}</caption><thead><tr><th>{tx("Billing month")}</th><th>kWh</th><th>{tx("Bill amount (₹)")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.month}><td>{row.month}</td><td>{row.units}</td><td>{row.amount}</td></tr>)}</tbody></table>
  </div>;
}