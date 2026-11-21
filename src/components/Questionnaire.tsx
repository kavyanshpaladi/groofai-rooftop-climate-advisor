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
      {QUESTIONS.map((q) => (
        <div key={q.key}>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{q.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((o) => {
              const active = value[q.key] === o.value;
              return (
                <button key={String(o.value)} type="button" onClick={() => onChange({ ...value, [q.key]: o.value })}
                  className={`rounded-md border px-2.5 py-1 text-xs ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}>
                  {o.label}
                </button>
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
