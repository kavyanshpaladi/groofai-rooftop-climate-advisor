import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { ADVISOR_IMAGE_TYPES, ADVISOR_MAX_IMAGE_BYTES } from "@/lib/advisor";
import { compressImage } from "@/lib/advisor-image";
import { scanElectricityBill } from "@/lib/advisor.functions";
import { BILL_CATEGORIES, billTariff, monthlyBillValue, type BillResult } from "@/lib/bill";

const INPUT = "mt-1 h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-ring/50";
type NumericKey = "units_kwh" | "bill_amount_inr" | "billing_period_days" | "sanctioned_load_kw";
const FIELDS: [NumericKey, string][] = [["units_kwh", "Units consumed (kWh)"], ["bill_amount_inr", "Bill amount (₹)"], ["billing_period_days", "Billing period (days)"], ["sanctioned_load_kw", "Sanctioned load (kW)"]];

export function BillScanner({ bill, onChange, onBusy, onScanned }: { bill: BillResult | null; onChange: (bill: BillResult, fill: boolean) => void; onBusy: (busy: boolean) => void; onScanned?: (bill: BillResult) => void }) {
  const { tx, lang } = useI18n();
  const scan = useServerFn(scanElectricityBill);
  const upload = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(file: File | undefined) {
    if (!file || busy) return;
    setError("");
    if (!(ADVISOR_IMAGE_TYPES as readonly string[]).includes(file.type)) return setError(tx("Please choose a JPG, PNG or WebP photo."));
    if (file.size > ADVISOR_MAX_IMAGE_BYTES) return setError(tx("That photo is larger than 8 MB. Please choose a smaller one."));
    setBusy(true);
    onBusy(true);
    try {
      const photo = await compressImage(file);
      setPreview(photo.url);
      const out = await scan({ data: { image: { mimeType: photo.mimeType, data: photo.data }, language: lang } });
      if ("result" in out) { onChange(out.result, true); onScanned?.(out.result); }
      else setError(tx(out.error === "limited" ? "You've scanned several bills or asked for advice recently. Please try again in about 10 minutes." : out.error === "busy" ? "Bill reading is busy right now. Please try again in a minute." : "We couldn't read your bill. Please try another photo or enter your details manually."));
    } catch {
      setError(tx("We couldn't read your bill. Please try another photo or enter your details manually."));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  function edit(key: NumericKey, raw: string) {
    if (!bill) return;
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0 || (key === "billing_period_days" && value === 0))) return;
    const next = { ...bill, [key]: value };
    onChange({ ...next, cost_per_unit_inr: billTariff(next) }, key !== "sanctioned_load_kw");
  }

  const incomplete = bill && (bill.confidence === "low" || bill.confidence === null || FIELDS.some(([key]) => bill[key] === null) || !bill.tariff_category || bill.tariff_category === "unknown");
  const monthly = bill ? monthlyBillValue(bill.units_kwh, bill.billing_period_days) : null;
  const monthlyAmount = bill ? monthlyBillValue(bill.bill_amount_inr, bill.billing_period_days) : null;
  return (
    <div className="space-y-3 border-b border-border pb-5">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" disabled={busy} onClick={() => upload.current?.click()}><Camera />{tx("Scan my bill")}</Button>
        <Button variant="ghost" className="text-foreground" disabled={busy} onClick={() => camera.current?.click()}><Camera />{tx("Take photo")}</Button>
      </div>
      <p className="text-sm text-muted-foreground print:hidden">{tx("Skip typing: upload a photo of your electricity bill")}</p>
      <input ref={upload} type="file" className="sr-only" tabIndex={-1} accept={ADVISOR_IMAGE_TYPES.join(",")} aria-label={tx("Upload electricity bill")} disabled={busy} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={camera} type="file" className="sr-only" tabIndex={-1} accept={ADVISOR_IMAGE_TYPES.join(",")} capture="environment" aria-label={tx("Photograph electricity bill")} disabled={busy} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      {preview && <img src={preview} alt={tx("Your electricity bill photo")} className="max-h-64 max-w-full rounded-lg object-contain print:hidden" />}
      <div aria-live="polite" aria-busy={busy}>
        {busy && <p className="flex items-center gap-2 text-sm font-medium text-primary"><ImageUp className="size-4" />{tx("Reading your bill...")}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      {bill && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">{tx("Read from your bill")}</h3>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-foreground">{tx("Confidence")}: {tx(bill.confidence === "high" ? "High" : bill.confidence === "medium" ? "Medium" : "Low")}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(([key, label]) => <label key={key} className="min-w-0 text-xs font-medium text-foreground" htmlFor={`bill-${key}`}>{tx(label)}<input id={`bill-${key}`} className={INPUT} type="number" inputMode="decimal" min={key === "billing_period_days" ? 1 : 0} step="any" value={bill[key] ?? ""} disabled={busy} onChange={(e) => edit(key, e.target.value)} /></label>)}
            <label className="min-w-0 text-xs font-medium text-foreground" htmlFor="bill-category">{tx("Tariff category")}<select id="bill-category" className={INPUT} value={bill.tariff_category ?? "unknown"} disabled={busy} onChange={(e) => { const category = BILL_CATEGORIES.find((c) => c === e.target.value); if (category) onChange({ ...bill, tariff_category: category }, false); }}>{BILL_CATEGORIES.map((category) => <option key={category} value={category}>{tx(category)}</option>)}</select></label>
            <label className="min-w-0 text-xs font-medium text-foreground" htmlFor="bill-month">{tx("Billing month")}<input id="bill-month" className={INPUT} maxLength={60} value={bill.billing_month ?? ""} disabled={busy} onChange={(e) => onChange({ ...bill, billing_month: e.target.value || null }, false)} /></label>
            <label className="min-w-0 text-xs font-medium text-foreground" htmlFor="bill-tariff">{tx("Cost per unit (₹/kWh)")}<input id="bill-tariff" className={INPUT} type="number" inputMode="decimal" min={0} step="any" value={bill.cost_per_unit_inr === null ? "" : Math.round(bill.cost_per_unit_inr * 100) / 100} disabled={busy || bill.units_kwh === null || bill.units_kwh <= 0 || bill.bill_amount_inr === null} onChange={(e) => { const rate = Number(e.target.value); if (bill.units_kwh !== null && Number.isFinite(rate) && rate >= 0) { const next = { ...bill, bill_amount_inr: Math.round(rate * bill.units_kwh * 100) / 100 }; onChange({ ...next, cost_per_unit_inr: billTariff(next) }, true); } }} /></label>
          </div>
          {bill.billing_period_days !== null && bill.billing_period_days !== 30 && monthly !== null && <p className="text-xs text-muted-foreground">{tx("Normalised to 30 days: {n} kWh/month from a {days}-day bill.", { n: monthly, days: bill.billing_period_days })}</p>}
          {bill.billing_period_days !== null && bill.billing_period_days !== 30 && monthly === null && monthlyAmount !== null && <p className="text-xs text-muted-foreground">{tx("Normalised to 30 days: ₹{n}/month from a {days}-day bill.", { n: monthlyAmount, days: bill.billing_period_days })}</p>}
          {bill.billing_period_days === null && <p className="text-xs text-muted-foreground">{tx("Add the billing period to calculate monthly use. Your manual entry has not changed.")}</p>}
          {incomplete && <p className="text-sm text-foreground">{tx("We couldn't read everything. Please check and fill in the rest.")}</p>}
          {bill.notes && <p className="text-xs text-muted-foreground">{tx(bill.notes)}</p>}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{tx("Your bill photo is used only to read these numbers, and personal details are ignored.")}</p>
    </div>
  );
}