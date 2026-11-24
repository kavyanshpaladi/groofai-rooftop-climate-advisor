import type { Answers } from "./scoring";
import type { Climate } from "./climate";

export type Report = { area: number; usable: number; lat: number; lon: number; climate: Climate; answers: Answers };

const KEY = "roofwise-report";

export function saveReport(r: Report) {
  sessionStorage.setItem(KEY, JSON.stringify(r));
}

export function loadReport(): Report | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Report & { answers: Answers & { bill?: unknown } };
    // Older saved reports may still carry a bill value; drop it.
    const { bill: _bill, ...answers } = r.answers ?? ({} as Answers & { bill?: unknown });
    return { ...r, answers: answers as Answers };
  } catch {
    return null;
  }
}
