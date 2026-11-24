import { useState } from "react";
import type { OptionId } from "@/lib/scoring";

const PANELS = "bg-[repeating-linear-gradient(90deg,var(--solar)_0_28px,var(--card)_28px_31px)]";
const AFTER: Record<OptionId, { label: string; className: string }> = {
  solar: { label: "Solar panels", className: PANELS },
  green: { label: "Green roof", className: "bg-primary/70" },
  reflective: { label: "Reflective coating", className: "bg-card" },
  rainwater: { label: "Rainwater harvesting", className: "bg-[linear-gradient(180deg,var(--water)_0_100%)]" },
  hybrid: { label: "Hybrid roof", className: "" },
};

/**
 * Before/after roof preview. For solar and hybrid, `coverage` (0–1) is the share of the
 * usable roof the panels occupy, so the picture matches the recommended system size.
 */
export function BeforeAfter({ option, coverage }: { option: OptionId; coverage?: number | undefined }) {
  const [pos, setPos] = useState(50);
  const after = AFTER[option];
  const share = Math.max(0, Math.min(1, coverage ?? 1));
  const pct = Math.round(share * 100);
  const usesPanels = option === "solar" || option === "hybrid";
  return (
    <div className="print:hidden">
      <div className="relative h-52 overflow-hidden rounded-xl border border-border bg-muted-foreground/60 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring sm:h-60">
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          {usesPanels ? (
            <div className={`absolute inset-0 ${option === "hybrid" ? "bg-primary/70" : ""}`}>
              <div className={`absolute inset-y-0 left-0 ${PANELS}`} style={{ width: `${pct}%` }} />
            </div>
          ) : (
            <div className={`absolute inset-0 ${after.className}`} />
          )}
        </div>
        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-card px-2.5 py-1 text-sm font-semibold text-foreground shadow-sm">Before</span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-card px-2.5 py-1 text-sm font-semibold text-foreground shadow-sm">After: {after.label}</span>
        <div className="pointer-events-none absolute inset-y-0 w-1 -translate-x-1/2 bg-card shadow" style={{ left: `${pos}%` }}>
          <div className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-primary bg-card text-base font-bold text-primary shadow-lg">
            ‹›
          </div>
        </div>
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Drag to compare before and after"
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0 focus-visible:opacity-0" />
      </div>
      {usesPanels && (
        <p className="mt-2 text-sm text-foreground/80">Panels cover about {pct}% of your usable roof</p>
      )}
    </div>
  );
}
