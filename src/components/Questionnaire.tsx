import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Answers } from "@/lib/scoring";

type Q<K extends keyof Answers> = { key: K; label: string; options: { value: Answers[K]; label: string }[] };

const QUESTIONS = [
  { key: "roofType", label: "Roof type", options: [{ value: "flat", label: "Flat" }, { value: "sloped", label: "Sloped" }] },
  { key: "shade", label: "Shade", options: [{ value: "none", label: "None" }, { value: "some", label: "Some" }, { value: "heavy", label: "Heavy" }] },
  { key: "access", label: "Access", options: [{ value: "easy", label: "Easy" }, { value: "limited", label: "Limited" }] },
  { key: "priority", label: "Priority", options: [{ value: "bill", label: "Electricity bill" }, { value: "cooler", label: "Cooler rooms" }, { value: "garden", label: "Garden" }, { value: "rainwater", label: "Rainwater" }] },
  { key: "budget", label: "Budget", options: [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }] },
] as Q<keyof Answers>[];

export type Draft = Partial<Answers> & { bill: number };

export function Questionnaire({ value, onChange }: { value: Draft; onChange: (v: Draft) => void }) {
  return (
    <div className="space-y-3">
      <p aria-live="polite" className="text-xs font-medium text-muted-foreground">{QUESTIONS.filter((q) => value[q.key]).length} of 5 answered</p>
      {QUESTIONS.map((q) => (
        <div key={q.key}>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{q.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((o) => {
              const active = value[q.key] === o.value;
              return (
                <Button key={String(o.value)} type="button" variant="chip" size="sm" aria-pressed={active} onClick={() => onChange({ ...value, [q.key]: o.value })}
                  className="gap-1.5 px-2.5">
                  <Check aria-hidden="true" className={active ? "opacity-100" : "opacity-0"} />
                  {o.label}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Monthly electricity bill (₹, optional)</span>
        <input type="number" min={0} value={value.bill} onChange={(e) => onChange({ ...value, bill: Number(e.target.value) || 0 })}
          className="w-full rounded-md border border-input bg-card px-2 py-1 text-sm" />
      </label>
    </div>
  );
}

export function isComplete(d: Draft): d is Answers {
  return !!(d.roofType && d.shade && d.access && d.priority && d.budget);
}
