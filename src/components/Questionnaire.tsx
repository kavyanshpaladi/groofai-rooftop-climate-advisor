import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUDGET_LABELS, type Answers, type Budget } from "@/lib/scoring";

type Q<K extends keyof Answers> = { key: K; label: string; options: { value: Answers[K]; label: string }[] };

const QUESTIONS = [
  { key: "roofType", label: "Roof type", options: [{ value: "flat", label: "Flat" }, { value: "sloped", label: "Sloped" }] },
  { key: "shade", label: "Shade", options: [{ value: "none", label: "None" }, { value: "some", label: "Some" }, { value: "heavy", label: "Heavy" }] },
  { key: "access", label: "Access", options: [{ value: "easy", label: "Easy" }, { value: "limited", label: "Limited" }] },
  { key: "priority", label: "Priority", options: [{ value: "bill", label: "Electricity bill" }, { value: "cooler", label: "Cooler rooms" }, { value: "garden", label: "Garden" }, { value: "rainwater", label: "Rainwater" }] },
  { key: "budget", label: "Budget", options: (Object.keys(BUDGET_LABELS) as Budget[]).map((value) => ({ value, label: BUDGET_LABELS[value] })) },
] as Q<keyof Answers>[];

export type Draft = Partial<Answers>;

export function Questionnaire({ value, onChange }: { value: Draft; onChange: (v: Draft) => void }) {
  return (
    <div className="space-y-3">
      <p aria-live="polite" className="text-xs font-medium text-muted-foreground">{QUESTIONS.filter((q) => value[q.key]).length} of {QUESTIONS.length} answered</p>
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
    </div>
  );
}

export function isComplete(d: Draft): d is Answers {
  return !!(d.roofType && d.shade && d.access && d.priority && d.budget);
}
