/** One money format for the whole report: Indian grouping, lakh/crore short form for large values. */
export function formatInr(n: number): string {
  if (!isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)} L`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

/** Exact rupees with Indian grouping, for figures quoted in full. */
export const formatRupees = (n: number) => (isFinite(n) ? `₹${Math.round(n).toLocaleString("en-IN")}` : "—");

export const formatNum = (n: number) => Math.round(n).toLocaleString("en-IN");

/** Share of the usable roof covered by panels: recommended kW over the roof's max kW, capped at 100%. */
export function panelCoverShare(kw: number, roofMaxKw: number): number {
  if (!(roofMaxKw > 0) || !(kw > 0)) return 0;
  return Math.min(1, kw / roofMaxKw);
}
