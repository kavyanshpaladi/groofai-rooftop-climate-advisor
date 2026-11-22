import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Report } from "./report";
import type { OptionScore } from "./scoring";

const SENT_KEY = "roofwise-logged";

/** Key that identifies one analysis, so re-renders and refreshes don't log twice. */
export function analysisKey(report: Report): string {
  const s = JSON.stringify([report.lat, report.lon, report.area, report.usable, report.answers]);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}

/** Silently saves anonymous roof statistics once per analysis. Never throws. */
export async function logRoofReport(report: Report, scores: OptionScore[], estimates: Record<string, unknown>) {
  try {
    const key = analysisKey(report);
    if (sessionStorage.getItem(SENT_KEY) === key) return;
    sessionStorage.setItem(SENT_KEY, key);
    await supabase.from("roof_reports").insert({
      latitude: Math.round(report.lat * 1000) / 1000,
      longitude: Math.round(report.lon * 1000) / 1000,
      roof_area: report.area,
      usable_area: report.usable,
      answers: report.answers as unknown as Json,
      scores: scores.map((s) => ({ id: s.id, score: s.score })) as unknown as Json,
      best_option: scores[0]?.id ?? null,
      estimates: estimates as Json,
    });
  } catch {
    // ignore: logging must never affect the results page
  }
}
