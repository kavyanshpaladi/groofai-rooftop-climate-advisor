export type Climate = { irradiance: number; maxTemp: number; rainfall: number; fallback: boolean };

export const CLIMATE_FALLBACK: Climate = { irradiance: 5.5, maxTemp: 33, rainfall: 800, fallback: true };

export async function fetchClimate(lat: number, lon: number): Promise<Climate> {
  try {
    const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN,T2M_MAX,PRECTOTCORR&community=RE&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&format=JSON`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("failed");
    const json = (await res.json()) as { properties: { parameter: Record<string, Record<string, number>> } };
    const p = json.properties.parameter;
    const irr = p["ALLSKY_SFC_SW_DWN"]?.["ANN"];
    // ANN for T2M_MAX is the yearly peak, so average the 12 monthly values instead.
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"].map((m) => p["T2M_MAX"]?.[m]);
    const t = months.every((v) => v !== undefined) ? (months as number[]).reduce((x, y) => x + y, 0) / 12 : undefined;
    const pr = p["PRECTOTCORR"]?.["ANN"];
    if ([irr, t, pr].some((v) => v === undefined || v < -900)) throw new Error("bad data");
    return { irradiance: irr!, maxTemp: t!, rainfall: pr! * 365, fallback: false };
  } catch {
    return CLIMATE_FALLBACK;
  }
}
