import type { solarProjection } from "@/lib/impact";
import { formatInr } from "@/lib/format";
import { SectionHeading, StatTile } from "@/components/results/parts";
import { useI18n } from "@/lib/i18n";

type Projection = ReturnType<typeof solarProjection>;

const W = 640;
const H = 240;
const PAD = { l: 64, r: 16, t: 24, b: 32 };

export function SolarOutlook({ projection, id }: { projection: Projection; id?: string }) {
  const { tx } = useI18n();
  const pts = [{ year: 0, v: projection.startNet }, ...projection.rows.map((r) => ({ year: r.year, v: r.cumulativeNet }))];
  const years = pts.length - 1;
  const min = Math.min(0, ...pts.map((p) => p.v));
  const max = Math.max(0, ...pts.map((p) => p.v));
  const span = max - min || 1;
  const x = (y: number) => PAD.l + (y / years) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((max - v) / span) * (H - PAD.t - PAD.b);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const be = projection.breakEvenYear;
  const bePoint = be !== null ? pts[be] : undefined;
  const beLeft = bePoint ? x(bePoint.year) > W - 150 : false;

  return (
    <section id={id} className="outlook reveal rp-section rp-card rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <SectionHeading badge>{tx("25-year outlook")} <span className="text-base font-normal text-foreground/70">{tx("(solar)")}</span></SectionHeading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label={tx("Break-even")} value={be !== null ? tx("Year {n}", { n: be }) : tx("Not within 25 years")} />
        <StatTile label={tx("25-year net saving")} value={formatInr(projection.netSaving)} />
        <StatTile label={tx("Electricity generated")} value={`${projection.totalMwh.toFixed(1)} MWh`} className="col-span-2 sm:col-span-1" />
      </div>
      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[520px]" role="img" aria-label={tx("Cumulative net money over 25 years")}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth="1.5" />
          {[max, min].filter((v) => v !== 0).map((v) => (
            <text key={v} x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--foreground)" fillOpacity="0.7">{formatInr(v)}</text>
          ))}
          <text x={PAD.l - 6} y={y(0) + 4} textAnchor="end" fontSize="12" fill="var(--foreground)" fillOpacity="0.7">₹0</text>
          {[0, 5, 10, 15, 20, 25].filter((t) => t <= years).map((t) => (
            <text key={t} x={x(t)} y={H - 10} textAnchor="middle" fontSize="12" fill="var(--foreground)" fillOpacity="0.7">{t === 0 ? tx("Start") : tx("Yr {n}", { n: t })}</text>
          ))}
          <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />
          {bePoint && (
            <g>
              <line x1={x(bePoint.year)} x2={x(bePoint.year)} y1={PAD.t} y2={H - PAD.b} stroke="var(--primary)" strokeDasharray="4 4" strokeWidth="1" />
              <circle cx={x(bePoint.year)} cy={y(bePoint.v)} r="5" fill="var(--primary)" stroke="var(--card)" strokeWidth="2" />
              <text x={x(bePoint.year) + (beLeft ? -8 : 8)} y={PAD.t - 6} textAnchor={beLeft ? "end" : "start"} fontSize="12" fontWeight="600" fill="var(--foreground)">
                {tx("Break-even: year {n}", { n: bePoint.year })}
              </text>
            </g>
          )}
        </svg>
      </div>
      <p className="mt-2 text-sm text-foreground/70">{tx("Cumulative savings minus system cost (after subsidy), with rising tariffs, panel wear and yearly maintenance.")}</p>
    </section>
  );
}
