import { useId, useState, type CSSProperties } from "react";
import { ChevronDown, ExternalLink, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RoughBadge, StatTile, Tween } from "@/components/results/parts";
import { FULL_SUBSIDY_KW, PANEL_KW, loanEmi, subsidyFor, type Assumptions, type solarForKw } from "@/lib/impact";
import { formatRupees } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";

const THUMB = 22;
/** Left offset of a point on the range track, allowing for the thumb's width. */
const at = (f: number) => `calc(${(f * 100).toFixed(2)}% + ${((0.5 - f) * THUMB).toFixed(2)}px)`;
const kwText = (kw: number) => String(Number(kw.toFixed(1)));
const pct = (n: number) => String(Number(n.toFixed(2)));

/** Date the links below were last opened and compared with the rates used here. Update it whenever they are re-checked. */
const SOURCES_CHECKED = "24 November 2026";
const SOURCES: { label: TKey; detail: TKey; href: string; loan?: boolean }[] = [
  { label: "src1", detail: "src1d", href: "https://pmsuryaghar.gov.in/" },
  { label: "src2", detail: "src2d", href: "https://www.pmindia.gov.in/en/news_updates/cabinet-approves-pm-surya-ghar-muft-bijli-yojana-for-installing-rooftop-solar-in-one-crore-households/" },
  { label: "src3", detail: "src3d", href: "https://mnre.gov.in/static/uploads/2025/08/f20f6d61628866e66b612810b49abd78.pdf" },
  { label: "src4", detail: "src4d", href: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2290407", loan: true },
  { label: "src5", detail: "src5d", href: "https://sbi.bank.in/web/personal-banking/loans/pm-surya-ghar-loan-for-solar-roof-top", loan: true },
];

const STEP_NUM = "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary";
const YOURS = "mt-1 rounded-md bg-card/70 px-2 py-1 tabular-nums text-foreground/80";

type Props = {
  id?: string;
  panels: number;
  maxPanels: number;
  edited: boolean;
  solar: ReturnType<typeof solarForKw>;
  assumptions: Assumptions;
  onPanels: (panels: number) => void;
  onReset: () => void;
};

/** Government subsidy for the chosen system size, a "what if" size slider and an optional bank-loan view. Nothing here is saved. */
export function SubsidyCard({ id, panels, maxPanels, edited, solar, assumptions: a, onPanels, onReset }: Props) {
  const { t, rich } = useI18n();
  const sliderId = useId();
  const loanId = useId();
  // Display split of the subsidy already computed in lib/impact (same bands as subsidyFor).
  const firstKw = Math.min(solar.kw, 2);
  const restKw = Math.min(Math.max(solar.kw - 2, 0), FULL_SUBSIDY_KW - 2);
  const beyondKw = Math.max(solar.kw - FULL_SUBSIDY_KW, 0);
  const firstAmount = Math.min(solar.subsidy, subsidyFor(firstKw, a));
  const restAmount = solar.subsidy - firstAmount;
  const [loan, setLoan] = useState(false);

  const span = Math.max(1, maxPanels - 1);
  const fill = (panels - 1) / span;
  const fullPanels = FULL_SUBSIDY_KW / PANEL_KW;
  const markerAt = maxPanels >= fullPanels ? (fullPanels - 1) / span : null;
  const payback = isFinite(solar.payback) ? t("years", { n: solar.payback.toFixed(1) }) : "—";
  const panelsText = t(panels === 1 ? "panels1" : "panelsN", { n: panels });
  const emi = loanEmi(solar.cost, a.loanInterestPct, a.loanYears);
  const saving = solar.savings / 12;
  const months = Math.max(1, Math.round(a.loanYears * 12));
  const repaid = Math.round(emi) * months;

  return (
    <section id={id} className="reveal rp-section rp-card rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold text-foreground">{t("subTitle")}</h2>
        <RoughBadge />
      </div>
      <p className="text-sm text-foreground/70">
        {t("subIntro", { perKw: formatRupees(a.subsidyPerKw), third: formatRupees(a.subsidyThirdKw) })}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label={t("tileCost")} value={<Tween value={solar.cost} format={formatRupees} />} />
        <StatTile label={t("tileSubsidy")} value={<Tween value={solar.subsidy} format={formatRupees} />} />
        <StatTile label={t("tilePay")} value={<Tween value={solar.netCost} format={formatRupees} />} className="col-span-2 sm:col-span-1" />
      </div>

      <div className="mt-5 print:hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <label htmlFor={sliderId} className="text-sm font-semibold text-foreground">{t("sizeLabel")}</label>
          <span className="text-sm tabular-nums text-foreground/80">
            {panelsText} · {solar.kw.toFixed(1)} kW
          </span>
        </div>
        <div className="relative pb-6">
          <input
            id={sliderId} type="range" min={1} max={Math.max(2, maxPanels)} step={1} value={panels} disabled={maxPanels < 2}
            onChange={(e) => onPanels(Math.max(1, Math.min(maxPanels, Math.round(Number(e.target.value)) || 1)))}
            aria-valuetext={t("sliderAria", { panels: panelsText, kw: solar.kw.toFixed(1) })}
            className="whatif-range" style={{ "--fill": at(fill) } as CSSProperties}
          />
          {markerAt !== null && (
            <div
              className={`pointer-events-none absolute top-[14px] flex flex-col ${markerAt > 0.85 ? "items-end" : markerAt < 0.15 ? "items-start" : "items-center"}`}
              style={{ left: at(markerAt), transform: `translateX(${markerAt > 0.85 ? "-100%" : markerAt < 0.15 ? "0" : "-50%"})` }}
            >
              <span className="h-4 w-0.5 rounded-full bg-primary/60" />
              <span className="mt-4 whitespace-nowrap text-xs font-medium text-primary">{t("fullSubsidy")}</span>
            </div>
          )}
        </div>
      </div>

      <p className="mt-1 text-sm font-medium text-foreground sm:text-base" aria-live="polite">
        {t("liveLine", { kw: kwText(solar.kw), subsidy: formatRupees(solar.subsidy), pay: formatRupees(solar.netCost), payback })}
        {edited && (
          <button type="button" onClick={onReset} className="ml-2 text-xs font-medium text-primary underline underline-offset-2 print:hidden">
            {t("resetSuggested")}
          </button>
        )}
      </p>

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex min-h-11 items-center gap-3">
          <Switch id={loanId} checked={loan} onCheckedChange={setLoan} />
          <label htmlFor={loanId} className="cursor-pointer text-sm font-semibold text-foreground sm:text-base">{t("loanToggle")}</label>
        </div>
        {loan && (
          <>
            <div className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <StatTile label={t("emi")} value={<Tween value={emi} format={formatRupees} />} />
              <StatTile label={t("monthlySaving")} value={<Tween value={saving} format={formatRupees} />} />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground sm:text-base" aria-live="polite">
              {Math.round(saving) >= Math.round(emi)
                ? t("verdictGood")
                : t("verdictBad", { amount: formatRupees(Math.round(emi) - Math.round(saving)) })}
            </p>
            <p className="mt-2 text-sm text-foreground/70">
              {t("loanHelper")}
            </p>

            <details className="group/loan mt-4 rounded-lg border border-primary/20 bg-primary/5 text-sm text-foreground/80">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 font-medium text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <Info className="size-4 shrink-0 text-primary/70" aria-hidden />
                <span className="flex-1">{t("loanHow")}</span>
                <ChevronDown className="size-4 shrink-0 text-foreground/50 transition-transform duration-200 group-open/loan:rotate-180 motion-reduce:transition-none" aria-hidden />
              </summary>
              <div className="border-t border-primary/20 px-3 pb-3 pt-3">
                <ol className="space-y-3">
                  <li className="flex gap-2.5">
                    <span className={STEP_NUM} aria-hidden>1</span>
                    <div className="min-w-0 flex-1">
                      <p>{rich("l1")}</p>
                      <p className={YOURS}>{t("yours")} {kwText(solar.kw)} kW × {formatRupees(a.costPerKw)} = <strong className="font-semibold text-foreground">{formatRupees(solar.cost)}</strong></p>
                    </div>
                  </li>
                  <li className="flex gap-2.5">
                    <span className={STEP_NUM} aria-hidden>2</span>
                    <div className="min-w-0 flex-1">
                      <p>{rich("l2", { rate: pct(a.loanInterestPct), years: pct(a.loanYears) })}</p>
                      <p className={YOURS}>{t("yours")} {t("l2Yours", { rate: pct(a.loanInterestPct), monthly: pct(a.loanInterestPct / 12), months })}</p>
                    </div>
                  </li>
                  <li className="flex gap-2.5">
                    <span className={STEP_NUM} aria-hidden>3</span>
                    <div className="min-w-0 flex-1">
                      <p>{rich("l3")}</p>
                      <p className={YOURS}>{t("yours")} {rich("l3Yours", { emi: <strong className="font-semibold text-primary">{formatRupees(emi)}</strong> })}</p>
                    </div>
                  </li>
                  <li className="flex gap-2.5">
                    <span className={STEP_NUM} aria-hidden>4</span>
                    <div className="min-w-0 flex-1">
                      <p>{rich("l4")}</p>
                      <p className={YOURS}>
                        {t("yours")} {rich("l4Yours", { emi: formatRupees(emi), months, total: <strong className="font-semibold text-foreground">{formatRupees(repaid)}</strong>, interest: <strong className="font-semibold text-foreground">{formatRupees(Math.max(0, repaid - solar.cost))}</strong> })}
                      </p>
                    </div>
                  </li>
                </ol>

                <p className="mt-3 text-xs text-foreground/70">
                  {t("loanNote", { subsidy: formatRupees(solar.subsidy) })}
                </p>

                <details className="group/lsrc mt-2">
                  <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 rounded text-[11px] font-semibold uppercase tracking-wide text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    {t("checkYourself")}
                    <ChevronDown className="size-3.5 transition-transform duration-200 group-open/lsrc:rotate-180 motion-reduce:transition-none" aria-hidden />
                  </summary>
                  <ul className="mt-1 space-y-1.5 pb-1 text-xs">
                    {SOURCES.filter((src) => src.loan).map((src) => (
                      <li key={src.href}>
                        <a href={src.href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
                          {t(src.label)}
                          <ExternalLink className="ml-1 inline size-3 align-[-1px]" aria-hidden />
                          <span className="sr-only">{t("newTab")}</span>
                        </a>
                        <span className="text-foreground/70"> · {t(src.detail)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("loanChecked", { date: SOURCES_CHECKED })}
                </p>
              </div>
            </details>
          </>
        )}
      </div>

      <details className="group/how mt-4 rounded-lg border border-primary/20 bg-primary/5 text-sm text-foreground/80">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 font-medium text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <Info className="size-4 shrink-0 text-primary/70" aria-hidden />
          <span className="flex-1">{t("subHow")}</span>
          <ChevronDown className="size-4 shrink-0 text-foreground/50 transition-transform duration-200 group-open/how:rotate-180 motion-reduce:transition-none" aria-hidden />
        </summary>
        <div className="border-t border-primary/20 px-3 pb-3 pt-3">
          <ol className="space-y-3">
            <li className="flex gap-2.5">
              <span className={STEP_NUM} aria-hidden>1</span>
              <div className="min-w-0 flex-1">
                <p>{rich("s1", { rate: formatRupees(a.costPerKw) })}</p>
                <p className={YOURS}>{t("yours")} {kwText(solar.kw)} kW × {formatRupees(a.costPerKw)} = <strong className="font-semibold text-foreground">{formatRupees(solar.cost)}</strong></p>
              </div>
            </li>
            <li className="flex gap-2.5">
              <span className={STEP_NUM} aria-hidden>2</span>
              <div className="min-w-0 flex-1">
                <p>
                  {rich("s2", { perKw: formatRupees(a.subsidyPerKw), third: formatRupees(a.subsidyThirdKw), full: FULL_SUBSIDY_KW, max: formatRupees(subsidyFor(FULL_SUBSIDY_KW, a)) })}
                </p>
                <p className={YOURS}>
                  {t("yours")} {t("s2First", { amount: formatRupees(firstAmount), kw: kwText(firstKw) })}
                  {restKw > 0 && <> + {t("s2Next", { amount: formatRupees(restAmount), kw: kwText(restKw) })}</>} = <strong className="font-semibold text-primary">{formatRupees(solar.subsidy)}</strong>
                  {beyondKw > 0 && <>. {t("s2Beyond", { kw: kwText(beyondKw), full: FULL_SUBSIDY_KW })}</>}
                </p>
              </div>
            </li>
            <li className="flex gap-2.5">
              <span className={STEP_NUM} aria-hidden>3</span>
              <div className="min-w-0 flex-1">
                <p>{rich("s3")}</p>
                <p className={YOURS}>
                  {t("yours")} {formatRupees(solar.cost)} − {formatRupees(solar.subsidy)} = <strong className="font-semibold text-foreground">{formatRupees(solar.netCost)}</strong>
                  {isFinite(solar.payback) && rich("s3Yours", { pay: formatRupees(solar.netCost), saving: formatRupees(solar.savings), payback: <strong className="font-semibold text-foreground">{payback}</strong> })}
                </p>
              </div>
            </li>
          </ol>

          <p className="mt-3 text-xs text-foreground/70">
            {t("subNote")}
          </p>

          <details className="group/src mt-2">
            <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 rounded text-[11px] font-semibold uppercase tracking-wide text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              {t("checkYourself")}
              <ChevronDown className="size-3.5 transition-transform duration-200 group-open/src:rotate-180 motion-reduce:transition-none" aria-hidden />
            </summary>
            <ul className="mt-1 space-y-1.5 pb-1 text-xs">
              {SOURCES.map((src) => (
                <li key={src.href}>
                  <a href={src.href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
                    {t(src.label)}
                    <ExternalLink className="ml-1 inline size-3 align-[-1px]" aria-hidden />
                    <span className="sr-only">{t("newTab")}</span>
                  </a>
                  <span className="text-foreground/70"> · {t(src.detail)}</span>
                </li>
              ))}
            </ul>
          </details>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("subChecked", { date: SOURCES_CHECKED })}
          </p>
        </div>
      </details>
    </section>
  );
}
