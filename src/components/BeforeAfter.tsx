import { useState } from "react";
import type { OptionId } from "@/lib/scoring";

const AFTER: Record<OptionId, { label: string; className: string }> = {
  solar: { label: "Solar panels", className: "bg-[repeating-linear-gradient(90deg,var(--solar)_0_28px,var(--card)_28px_31px)]" },
  green: { label: "Green roof", className: "bg-primary/70" },
  reflective: { label: "Reflective coating", className: "bg-card" },
  rainwater: { label: "Rainwater harvesting", className: "bg-[linear-gradient(180deg,var(--water)_0_100%)]" },
  hybrid: { label: "Hybrid roof", className: "bg-[linear-gradient(90deg,var(--solar)_0_50%,var(--primary)_50%_100%)]" },
};

export function BeforeAfter({ option }: { option: OptionId }) {
  const [pos, setPos] = useState(50);
  const after = AFTER[option];
  return (
    <div className="print:hidden">
      <div className="relative h-48 overflow-hidden rounded-xl border border-border bg-muted-foreground/60">
        <span className="absolute left-3 top-3 rounded bg-card px-2 py-0.5 text-xs">Before</span>
        <div className={`absolute inset-0 ${after.className}`} style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
        <span className="absolute right-3 top-3 rounded border border-border bg-card px-2 py-0.5 text-xs">After: {after.label}</span>
        <div className="absolute inset-y-0 w-0.5 bg-card" style={{ left: `${pos}%` }} />
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Before and after" className="mt-2 w-full accent-primary" />
    </div>
  );
}
