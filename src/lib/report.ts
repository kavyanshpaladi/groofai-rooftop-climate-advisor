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
    return raw ? (JSON.parse(raw) as Report) : null;
  } catch {
    return null;
  }
}
