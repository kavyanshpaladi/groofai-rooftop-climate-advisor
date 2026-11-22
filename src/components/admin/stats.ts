export type ReportRow = {
  id: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  roof_area: number | null;
  usable_area: number | null;
  answers: Record<string, unknown> | null;
  best_option: string | null;
  estimates: Record<string, unknown> | null;
};

export const OPTIONS = [
  { id: "solar", label: "Solar" },
  { id: "green", label: "Green roof" },
  { id: "reflective", label: "Reflective" },
  { id: "rainwater", label: "Rainwater" },
  { id: "hybrid", label: "Hybrid" },
] as const;

export const optionLabel = (id: string | null) => OPTIONS.find((o) => o.id === id)?.label ?? id ?? "—";

export function computeStats(rows: ReportRow[], now = new Date()) {
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = now.getTime() - 7 * 86400000;
  let today = 0, week = 0, usableSum = 0, usableN = 0, kwh = 0;
  const counts: Record<string, number> = Object.fromEntries(OPTIONS.map((o) => [o.id, 0]));
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    if (t >= startToday) today++;
    if (t >= weekAgo) week++;
    if (typeof r.usable_area === "number" || typeof r.usable_area === "string") { usableSum += Number(r.usable_area); usableN++; }
    const k = Number((r.estimates as { solarKwhYear?: unknown } | null)?.solarKwhYear);
    if (Number.isFinite(k)) kwh += k;
    if (r.best_option && r.best_option in counts) counts[r.best_option] = (counts[r.best_option] ?? 0) + 1;
  }
  return { total: rows.length, today, week, avgUsable: usableN ? usableSum / usableN : 0, kwh, counts };
}

export function toCsv(rows: ReportRow[]): string {
  const head = ["date", "best_option", "roof_area_m2", "usable_area_m2", "priority", "budget", "latitude", "longitude"];
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = rows.map((r) => [r.created_at, r.best_option, r.roof_area, r.usable_area, r.answers?.["priority"], r.answers?.["budget"], r.latitude, r.longitude].map(esc).join(","));
  return [head.join(","), ...lines].join("\n");
}
