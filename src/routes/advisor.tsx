import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/advisor")({
  head: () => ({
    meta: [
      { title: "AI Solar Advisor — groofai" },
      { name: "description", content: "Upload a rooftop photo, describe your energy use and get solar upgrade suggestions in plain words." },
      { property: "og:title", content: "AI Solar Advisor — groofai" },
      { property: "og:description", content: "Rooftop photo in, plain-language solar suggestions out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdvisorPage,
});

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, Check, ChevronDown, Download, ImageUp, MessageCircle, Pencil, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { useAdvisorChat } from "@/lib/chat-report";
import { getSolarAdvice } from "@/lib/advisor.functions";
import { ADVISOR_IMAGE_TYPES, APPLIANCES, toAdvisorChat, type AdvisorNeeds, type AdvisorRequest, type AdvisorResult } from "@/lib/advisor";
import { loadReport } from "@/lib/report";
import { DEFAULT_ASSUMPTIONS } from "@/lib/impact";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { compressImage, type AdvisorPhoto } from "@/lib/advisor-image";
import { fillNeedsFromBill, type BillResult } from "@/lib/bill";
import { useAdvisorProgress } from "@/lib/advisor-progress";
import { useServerFn } from "@tanstack/react-start";

type Photo = AdvisorPhoto;
const APPLIANCE_LABEL: Record<(typeof APPLIANCES)[number], string> = {
  ac: "AC", geyser: "Geyser", fridge: "Fridge", washing_machine: "Washing machine", ev_charger: "EV charger", water_pump: "Water pump", other: "Other",
};
const STEPS = ["Roof photo", "Energy needs", "Review"];
const DEFAULT_NEEDS: AdvisorNeeds = { billUnit: "inr", monthlyBill: 2000, people: 4, appliances: [], daytimeSharePct: 50, budget: "medium", notes: "" };

function AdvisorPage() {
  const { tx, lang } = useI18n();
  const { askAbout, clear } = useAdvisorChat();
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [needs, setNeeds] = useState<AdvisorNeeds>(DEFAULT_NEEDS);
  const [bill, setBill] = useState<BillResult | null>(null);
  const { save, load, takeBill, revision } = useAdvisorProgress();
  const [restored, setRestored] = useState(false);
  const advice = useServerFn(getSolarAdvice);
  const [roof, setRoof] = useState<AdvisorRequest["roof"]>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const draft = load();
    const incoming = takeBill();
    if (draft) {
      setPhoto(draft.photo);
      setNeeds(incoming ? fillNeedsFromBill(draft.needs, incoming) : draft.needs);
      setBill(incoming ?? draft.bill);
      setStep(incoming ? 1 : draft.step);
    } else if (incoming) {
      setNeeds(fillNeedsFromBill(DEFAULT_NEEDS, incoming));
      setBill(incoming);
      setStep(1);
    }
    setRestored(true);
  }, [load, takeBill, revision]);

  useEffect(() => {
    if (restored) save({ photo, needs, step, bill });
  }, [restored, photo, needs, step, bill, save]);

  useEffect(() => {
    const r = loadReport();
    if (r) setRoof({ usableAreaM2: Math.round(r.usable), sunKwhM2Day: Math.round(r.climate.irradiance * 10) / 10, tariffInrKwh: DEFAULT_ASSUMPTIONS.tariff });
    return clear;
  }, [clear]);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!(ADVISOR_IMAGE_TYPES as readonly string[]).includes(file.type)) return setError(tx("Please choose a JPG, PNG or WebP photo."));
    if (file.size > 8 * 1024 * 1024) return setError(tx("That photo is larger than 8 MB. Please choose a smaller one."));
    try {
      setPhoto(await compressImage(file));
    } catch {
      setError(tx("We couldn't read that photo. Please try another one."));
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void pickFile(e.dataTransfer.files[0]);
  }

  async function submit() {
    if (!photo) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const out = await advice({ data: { image: { mimeType: photo.mimeType, data: photo.data }, needs, ...(roof ? { roof } : {}), ...(bill ? { bill: { units_kwh: bill.units_kwh, bill_amount_inr: bill.bill_amount_inr, billing_period_days: bill.billing_period_days, cost_per_unit_inr: bill.cost_per_unit_inr, sanctioned_load_kw: bill.sanctioned_load_kw, tariff_category: bill.tariff_category } } : {}), language: lang } });
      if ("result" in out) setResult(out.result);
      else
        setError(
          out.error === "busy"
            ? tx("The advisor is busy right now. Please try again in a minute.")
            : out.error === "limited"
              ? tx("You've asked for several recommendations in a short time. Please try again in about 10 minutes.")
              : tx("We couldn't get a recommendation right now. Please try again."),
        );
    } catch {
      setError(tx("We couldn't get a recommendation right now. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  const showResults = loading || result;
  const toggleAppliance = (a: (typeof APPLIANCES)[number]) =>
    setNeeds((n) => ({ ...n, appliances: n.appliances.includes(a) ? n.appliances.filter((x) => x !== a) : [...n.appliances, a] }));

  return (
    <main className="min-h-dvh bg-background pb-24">
      <div className="mx-auto max-w-[760px] px-4 pt-6 sm:px-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 print:hidden">
          <Button asChild variant="ghost" size="sm" className="w-fit"><Link to="/"><ArrowLeft /> {tx("Home")}</Link></Button>
          <LanguageSwitcher />
        </header>
        <p className="mt-4 text-sm font-semibold text-primary">groofai</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{tx("AI Solar Advisor")}</h1>
        <p className="mt-2 text-muted-foreground">{tx("Upload a photo of your roof, tell us how you use electricity, and get solar suggestions in plain words.")}</p>
        <p className="mt-2 text-xs text-muted-foreground">{tx("Your photo is used only to generate this recommendation.")}</p>

        <div aria-live="assertive" className="mt-4">
          {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        </div>

        {!showResults && (
          <>
            <ol className="mt-6 grid grid-cols-3 gap-2" aria-label={tx("Progress")}>
              {STEPS.map((s, i) => (
                <li key={s} aria-current={i === step ? "step" : undefined} className="min-w-0">
                  <span className={cn("block h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
                  <span className={cn("mt-2 flex items-center gap-1 truncate text-xs font-medium", i === step ? "text-foreground" : "text-muted-foreground")}>
                    {i < step ? <Check className="size-3.5 shrink-0" /> : <span className="shrink-0">{i + 1}.</span>} {tx(s)}
                  </span>
                </li>
              ))}
            </ol>

            <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              {step === 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tx("Add a photo of your roof")}</h2>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={cn("mt-4 grid place-items-center rounded-xl border-2 border-dashed p-6 text-center transition-colors", dragging ? "border-primary bg-primary/5" : "border-border")}
                  >
                    {photo ? (
                      <img src={photo.url} alt={tx("Your roof photo")} className="max-h-72 rounded-lg object-contain" />
                    ) : (
                      <p className="text-sm text-muted-foreground"><ImageUp className="mx-auto mb-2 size-8 text-primary" />{tx("Drag a photo here, or choose one below. JPG, PNG or WebP, up to 8 MB.")}</p>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => fileRef.current?.click()}><ImageUp /> {photo ? tx("Choose another photo") : tx("Choose photo")}</Button>
                    <Button variant="outline" onClick={() => cameraRef.current?.click()}><Camera /> {tx("Take photo")}</Button>
                    <input ref={fileRef} type="file" accept={ADVISOR_IMAGE_TYPES.join(",")} className="sr-only" aria-label={tx("Choose photo")} onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
                    <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <Button asChild variant="link" className="h-auto max-w-full justify-start whitespace-normal px-0 text-left"><Link to="/bill-analyzer" onClick={() => save({ photo, needs, step, bill })}>{tx("Have an electricity bill? Scan it instead →")}</Link></Button>
                  <h2 className="text-lg font-semibold text-foreground">{tx("Your energy needs")}</h2>
                  <div>
                    <label htmlFor="adv-bill" className="text-sm font-medium text-foreground">{tx("Monthly electricity")}</label>
                    <div className="mt-1 flex gap-2">
                      <input id="adv-bill" type="number" min={0} inputMode="numeric" value={needs.monthlyBill} onChange={(e) => setNeeds({ ...needs, monthlyBill: Math.max(0, Number(e.target.value) || 0) })} className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-foreground focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-ring/50" />
                      <div role="group" aria-label={tx("Unit")} className="flex shrink-0 gap-1">
                        {(["inr", "kwh"] as const).map((u) => (
                          <Button key={u} type="button" variant={needs.billUnit === u ? "default" : "outline"} aria-pressed={needs.billUnit === u} onClick={() => setNeeds({ ...needs, billUnit: u })}>{u === "inr" ? "₹" : "kWh"}</Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="adv-people" className="text-sm font-medium text-foreground">{tx("People at home")}</label>
                    <input id="adv-people" type="number" min={1} max={30} value={needs.people} onChange={(e) => setNeeds({ ...needs, people: Math.min(30, Math.max(1, Math.round(Number(e.target.value) || 1))) })} className="mt-1 h-10 w-28 rounded-md border border-input bg-background px-3 text-foreground focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-ring/50" />
                  </div>
                  <fieldset>
                    <legend className="text-sm font-medium text-foreground">{tx("Appliances you use")}</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {APPLIANCES.map((a) => (
                        <Button key={a} type="button" size="sm" variant={needs.appliances.includes(a) ? "default" : "outline"} aria-pressed={needs.appliances.includes(a)} onClick={() => toggleAppliance(a)}>{tx(APPLIANCE_LABEL[a])}</Button>
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <label htmlFor="adv-day" className="text-sm font-medium text-foreground">{tx("When do you use most electricity?")}</label>
                    <input id="adv-day" type="range" min={0} max={100} step={10} value={needs.daytimeSharePct} onChange={(e) => setNeeds({ ...needs, daytimeSharePct: Number(e.target.value) })} className="mt-2 w-full accent-primary" aria-valuetext={tx("{n}% daytime", { n: needs.daytimeSharePct })} />
                    <div className="flex justify-between text-xs text-muted-foreground"><span>{tx("Mostly night")}</span><span>{tx("{n}% daytime", { n: needs.daytimeSharePct })}</span><span>{tx("Mostly day")}</span></div>
                  </div>
                  <fieldset>
                    <legend className="text-sm font-medium text-foreground">{tx("Budget")}</legend>
                    <div className="mt-2 flex gap-2">
                      {(["low", "medium", "high"] as const).map((b) => (
                        <Button key={b} type="button" variant={needs.budget === b ? "default" : "outline"} aria-pressed={needs.budget === b} onClick={() => setNeeds({ ...needs, budget: b })}>{tx(b === "low" ? "Low" : b === "medium" ? "Medium" : "High")}</Button>
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <label htmlFor="adv-notes" className="text-sm font-medium text-foreground">{tx("Anything else? (optional)")}</label>
                    <textarea id="adv-notes" maxLength={500} rows={3} value={needs.notes} onChange={(e) => setNeeds({ ...needs, notes: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background p-3 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-ring/50" />
                  </div>
                </div>
              )}

              {step === 2 && photo && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{tx("Check your answers")}</h2>
                  <img src={photo.url} alt={tx("Your roof photo")} className="max-h-48 rounded-lg object-contain" />
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">{tx("Monthly electricity")}</dt><dd className="text-foreground">{needs.billUnit === "inr" ? formatInr(needs.monthlyBill) : `${needs.monthlyBill} kWh`}</dd>
                    <dt className="text-muted-foreground">{tx("People at home")}</dt><dd className="text-foreground">{needs.people}</dd>
                    <dt className="text-muted-foreground">{tx("Appliances you use")}</dt><dd className="text-foreground">{needs.appliances.length ? needs.appliances.map((a) => tx(APPLIANCE_LABEL[a])).join(", ") : "—"}</dd>
                    <dt className="text-muted-foreground">{tx("Daytime use")}</dt><dd className="text-foreground">{needs.daytimeSharePct}%</dd>
                    <dt className="text-muted-foreground">{tx("Budget")}</dt><dd className="text-foreground">{tx(needs.budget === "low" ? "Low" : needs.budget === "medium" ? "Medium" : "High")}</dd>
                    {roof && <><dt className="text-muted-foreground">{tx("Roof from your report")}</dt><dd className="text-foreground">{tx("Usable area {area} m²", { area: roof.usableAreaM2 })}</dd></>}
                  </dl>
                </div>
              )}

              <div className="mt-6 flex justify-between gap-2">
                <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>{tx("Back")}</Button>
                {step < 2 ? (
                  <Button disabled={step === 0 && !photo} onClick={() => setStep((s) => s === 1 && !photo ? 0 : s + 1)}>{tx("Next")}</Button>
                ) : (
                  <Button onClick={() => void submit()}><Sparkles /> {tx("Get my recommendation")}</Button>
                )}
              </div>
            </section>
          </>
        )}

        {loading && (
          <section aria-live="polite" aria-busy="true" className="mt-6 space-y-4">
            <p className="text-sm font-medium text-foreground">{tx("Looking at your roof and working out your options…")}</p>
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </section>
        )}

        {result && photo && (
          <AdvisorResults
            result={result}
            photo={photo}
            onRetake={() => { setResult(null); setStep(0); }}
            onEdit={() => { setResult(null); setStep(1); }}
            onAsk={() => askAbout(toAdvisorChat(result))}
          />
        )}
      </div>
    </main>
  );
}

const LEVEL_STYLE = { low: "bg-destructive/15 text-destructive", medium: "bg-sun/20 text-foreground", high: "bg-primary/15 text-primary" } as const;

function AdvisorResults({ result, photo, onRetake, onEdit, onAsk }: { result: AdvisorResult; photo: Photo; onRetake: () => void; onEdit: () => void; onAsk: () => void }) {
  const { tx } = useI18n();
  const pa = result.photo_assessment;
  const recs = [...result.recommendations].sort((a, b) => a.priority - b.priority);
  return (
    <div className="mt-6 space-y-6" aria-live="polite">
      <p className="inline-flex rounded-full border border-sun/50 bg-sun/15 px-3 py-1 text-xs font-semibold text-foreground">{tx("Estimate only, not a professional survey")}</p>

      <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2">
        <img src={photo.url} alt={tx("Your roof photo")} className="w-full rounded-xl object-cover" />
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">{tx("What the AI saw")}</h2>
            <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", LEVEL_STYLE[pa.confidence])}>{tx("Confidence")}: {tx(pa.confidence)}</span>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{tx("Roof type")}</dt><dd className="text-foreground">{tx(pa.roof_type)}</dd>
            <dt className="text-muted-foreground">{tx("Shading risk")}</dt><dd className="text-foreground">{tx(pa.shading_risk)}</dd>
            <dt className="text-muted-foreground">{tx("Photo quality")}</dt><dd className="text-foreground">{tx(pa.photo_quality)}</dd>
            <dt className="text-muted-foreground">{tx("Usable share")}</dt><dd className="text-foreground">{Math.round(pa.estimated_usable_fraction * 100)}%</dd>
            <dt className="text-muted-foreground">{tx("Obstructions")}</dt><dd className="text-foreground">{pa.visible_obstructions.length ? pa.visible_obstructions.join(", ") : "—"}</dd>
            <dt className="text-muted-foreground">{tx("Daily use")}</dt><dd className="text-foreground">~{Math.round(result.energy_profile.estimated_daily_kwh)} kWh</dd>
          </dl>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">{tx("Recommendations")}</h2>
        {recs.map((r, i) => (
          <article key={i} className={cn("rounded-2xl border bg-card p-5 shadow-sm", i === 0 ? "border-2 border-primary" : "border-border")}>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{tx("Priority {n}", { n: r.priority })}</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{r.title}</h3>
            {r.type !== "not_recommended" && (
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [tx("Size"), `${r.suggested_size_kw} kW`],
                  [tx("Cost"), formatInr(r.estimated_cost_inr)],
                  [tx("Yearly savings"), formatInr(r.estimated_yearly_savings_inr)],
                  [tx("Payback"), `${r.payback_years.toFixed(1)} ${tx("yrs")}`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold text-foreground">{v}</dd></div>
                ))}
              </dl>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><h4 className="text-sm font-semibold text-foreground">{tx("Why this fits")}</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{r.why_this_fits.map((w, j) => <li key={j}>{w}</li>)}</ul></div>
              <div><h4 className="text-sm font-semibold text-foreground">{tx("Things to check")}</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{r.risks_or_caveats.map((w, j) => <li key={j}>{w}</li>)}</ul></div>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">{tx("In plain words")}</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/85">{result.explanation}</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">{tx("Next steps")}</h2>
        <ul className="mt-2 space-y-2">{result.next_steps.map((s, i) => <li key={i} className="flex gap-2 text-sm text-foreground"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{s}</li>)}</ul>
      </section>

      <details className="group rounded-2xl border border-border bg-card p-5 shadow-sm">
        <summary className="flex cursor-pointer items-center justify-between font-semibold text-foreground focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-ring/50">{tx("Assumptions")}<ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{result.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
      </details>

      <p className="text-xs text-muted-foreground">{tx("Your photo is used only to generate this recommendation.")}</p>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" onClick={onRetake}><RotateCcw /> {tx("Retake photo")}</Button>
        <Button variant="outline" onClick={onEdit}><Pencil /> {tx("Edit answers")}</Button>
        <Button variant="outline" onClick={() => window.print()}><Download /> {tx("Download as PDF")}</Button>
        <Button onClick={onAsk}><MessageCircle /> {tx("Ask the chatbot about this")}</Button>
      </div>
    </div>
  );
}
