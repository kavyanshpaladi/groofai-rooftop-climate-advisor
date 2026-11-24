import { BUDGET_LABELS, type Answers, type Budget } from "./scoring";
import type { Climate } from "./climate";

// `outline` is the selected roof as [lat, lng] corners, exactly as adjusted on the map (older reports lack it).
export type Report = { area: number; usable: number; lat: number; lon: number; climate: Climate; answers: Answers; outline?: [number, number][] };

const KEY = "roofwise-report";

export function saveReport(r: Report) {
  sessionStorage.setItem(KEY, JSON.stringify(r));
}

export function loadReport(): Report | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Report & { answers: Omit<Answers, "budget"> & { bill?: unknown; budget?: unknown } };
    // Older saved reports may carry a bill value (dropped) or no / old-style budget (treated as "Not sure").
    const { bill: _bill, budget, ...answers } = r.answers ?? ({} as Omit<Answers, "budget"> & { bill?: unknown; budget?: unknown });
    const b: Budget = typeof budget === "string" && budget in BUDGET_LABELS ? (budget as Budget) : "unsure";
    return { ...r, answers: { ...answers, budget: b } };
  } catch {
    return null;
  }
}
