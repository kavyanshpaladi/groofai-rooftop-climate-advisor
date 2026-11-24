import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts from 0 to the first target once on load; afterwards follows the live value directly. */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(target);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) { setValue(target); return; }
    if (prefersReducedMotion() || !isFinite(target)) { done.current = true; setValue(target); return; }
    let raf = 0;
    const start = performance.now();
    const finish = () => { done.current = true; setValue(target); };
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick); else finish();
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("beforeprint", finish);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("beforeprint", finish); if (!done.current) finish(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}

export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const v = useCountUp(value);
  return <>{format(v)}</>;
}

/** Adds `is-visible` to `.reveal` elements as they scroll into view (fade-in). */
export function useReveal(dep: unknown) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)"));
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("is-visible")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [dep]);
}

export function ScoreRing({ score, size = 112 }: { score: number; size?: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(prefersReducedMotion() ? score : 0);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(score)); return () => cancelAnimationFrame(id); }, [score]);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} out of 100`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--muted)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, shown)) / 100)} className="score-ring" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold leading-none text-foreground">{score}</span>
        <span className="mt-0.5 text-xs font-medium text-foreground/70">/100</span>
      </div>
    </div>
  );
}

export function StatTile({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-secondary/60 px-4 py-3", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-foreground/70">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-tight text-foreground sm:text-xl">{value}</p>
      {hint && <p className="mt-1 text-sm text-foreground/70">{hint}</p>}
    </div>
  );
}

export function RoughBadge() {
  return <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground/70">Rough estimates</span>;
}

export function SectionHeading({ children, badge = false, id }: { children: ReactNode; badge?: boolean; id?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <h2 id={id} className="text-xl font-semibold text-foreground">{children}</h2>
      {badge && <RoughBadge />}
    </div>
  );
}

/** Collapsible card; content stays in the page so printing expands everything. */
export function Disclosure({ header, children, defaultOpen = false, className }: { header: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("rp-card rounded-2xl border border-border bg-card shadow-sm", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="rp-disclosure flex w-full items-start gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring sm:p-5">
        <div className="min-w-0 flex-1">{header}</div>
        <ChevronDown className={cn("mt-1 size-5 shrink-0 text-foreground/70 transition-transform print:hidden", open && "rotate-180")} aria-hidden />
      </button>
      <div className={cn("px-4 pb-4 sm:px-5 sm:pb-5 print:block", !open && "hidden")}>{children}</div>
    </div>
  );
}

export type NavItem = { id: string; label: string };

export function SectionNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-80px 0px -60% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);
  
// Replace with (only scrolls the horizontal nav pill strip, leaving page scroll untouched):
useEffect(() => {
  const container = listRef.current;
  if (!container) return;
  const btn = container.querySelector<HTMLElement>(`[data-id="${active}"]`);
  if (!btn) return;

  const btnLeft = btn.offsetLeft;
  const btnRight = btnLeft + btn.offsetWidth;
  const scrollLeft = container.scrollLeft;
  const clientWidth = container.clientWidth;

  if (btnLeft < scrollLeft) {
    container.scrollTo({ left: btnLeft, behavior: "smooth" });
  } else if (btnRight > scrollLeft + clientWidth) {
    container.scrollTo({ left: btnRight - clientWidth, behavior: "smooth" });
  }
}, [active]);
  const go = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  };
  return (
    <nav aria-label="Report sections" className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/90 px-4 backdrop-blur print:hidden sm:-mx-6 sm:px-6">
      <div ref={listRef} className="no-scrollbar flex gap-1 overflow-x-auto py-2">
        {items.map((i) => (
          <button key={i.id} type="button" data-id={i.id} onClick={() => go(i.id)} aria-current={active === i.id ? "true" : undefined}
            className={cn("rp-navlink shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              active === i.id ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-accent hover:text-foreground")}>
            {i.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
