export type Assumptions = {
  panelCoverage: number;
  m2PerKw: number;
  performance: number;
  tariff: number;
  costPerKw: number;
  monthlyKwh: number;
  subsidy: number;
  tariffIncreasePct: number;
  degradationPct: number;
  maintenancePct: number;
  gridFactor: number;
  co2PerTree: number;
  reflectiveCostPerM2: number;
  greenCoverage: number;
  greenCostPerM2: number;
  co2PerM2: number;
  runoff: number;
  litresPerPersonDay: number;
  heatModerate: number;
  heatHigh: number;
  heatExtreme: number;
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  panelCoverage: 0.6,
  m2PerKw: 6.5,
  performance: 0.75,
  tariff: 7,
  costPerKw: 55000,
  monthlyKwh: 300,
  subsidy: 0,
  tariffIncreasePct: 3,
  degradationPct: 0.5,
  maintenancePct: 1,
  gridFactor: 0.7,
  co2PerTree: 21,
  reflectiveCostPerM2: 60,
  greenCoverage: 0.7,
  greenCostPerM2: 1200,
  co2PerM2: 2,
  runoff: 0.8,
  litresPerPersonDay: 135,
  heatModerate: 30,
  heatHigh: 35,
  heatExtreme: 40,
};

export const ASSUMPTION_LABELS: Record<keyof Assumptions, string> = {
  panelCoverage: "Share of usable area with panels",
  m2PerKw: "Roof area per kW (m²)",
  performance: "System performance ratio",
  tariff: "Electricity tariff (₹/kWh)",
  costPerKw: "Solar cost (₹/kW)",
  monthlyKwh: "Typical home electricity use (kWh/month)",
  subsidy: "Subsidy (₹) — check the official PM Surya Ghar portal",
  tariffIncreasePct: "Tariff increase per year (%)",
  degradationPct: "Panel degradation per year (%)",
  maintenancePct: "Maintenance per year (% of system cost)",
  gridFactor: "Grid emission factor (kg CO₂/kWh, approx.)",
  co2PerTree: "CO₂ absorbed per tree (kg/yr)",
  reflectiveCostPerM2: "Reflective coating cost (₹/m²)",
  greenCoverage: "Share of usable area planted",
  greenCostPerM2: "Green roof cost (₹/m²)",
  co2PerM2: "CO₂ offset (kg/m²/yr)",
  runoff: "Rainwater collection efficiency",
  litresPerPersonDay: "Water use per person (litres/day)",
  heatModerate: "Heat risk: moderate from (°C)",
  heatHigh: "Heat risk: high from (°C)",
  heatExtreme: "Heat risk: extreme above (°C)",
};

/** Solar sized to a typical home's yearly use, capped by what the roof can hold. */
export function solarImpact(usable: number, irradiance: number, a: Assumptions) {
  const roofMaxKw = Math.max(0, (usable * a.panelCoverage) / a.m2PerKw);
  const yieldPerKw = irradiance * 365 * a.performance;
  const annualDemandKwh = a.monthlyKwh * 12;
  const demandKw = yieldPerKw > 0 ? annualDemandKwh / yieldPerKw : 0;
  const kw = Math.min(roofMaxKw, demandKw);
  const kwhYear = kw * yieldPerKw;
  const savings = kwhYear * a.tariff;
  const cost = kw * a.costPerKw;
  const netCost = Math.max(0, cost - a.subsidy);
  return { kw, roofMaxKw, demandKw, kwhYear, savings, cost, netCost, payback: savings > 0 ? netCost / savings : Infinity };
}

export type ProjectionYear = { year: number; kwh: number; savings: number; cumulativeNet: number };

/** 25-year cash flow: degrading output, rising tariff, yearly maintenance, upfront cost minus subsidy. */
export function solarProjection(kwhYear1: number, cost: number, a: Assumptions, years = 25) {
  const maintenance = cost * (a.maintenancePct / 100);
  let cumulative = -(cost - a.subsidy);
  let totalKwh = 0;
  let breakEvenYear: number | null = cumulative >= 0 ? 0 : null;
  const rows: ProjectionYear[] = [];
  for (let y = 1; y <= years; y++) {
    const kwh = kwhYear1 * Math.pow(1 - a.degradationPct / 100, y - 1);
    const tariff = a.tariff * Math.pow(1 + a.tariffIncreasePct / 100, y - 1);
    const savings = kwh * tariff - maintenance;
    cumulative += savings;
    totalKwh += kwh;
    if (breakEvenYear === null && cumulative >= 0) breakEvenYear = y;
    rows.push({ year: y, kwh, savings, cumulativeNet: cumulative });
  }
  return { rows, startNet: -(cost - a.subsidy), breakEvenYear, netSaving: cumulative, totalMwh: totalKwh / 1000 };
}

export function co2Avoided(kwhYear: number, a: Assumptions) {
  const kg = kwhYear * a.gridFactor;
  return { kg, trees: a.co2PerTree > 0 ? kg / a.co2PerTree : 0 };
}

export function familyWaterDays(litresYear: number, a: Assumptions, people = 4) {
  const perDay = a.litresPerPersonDay * people;
  return perDay > 0 ? litresYear / perDay : 0;
}

export type HeatRisk = "Low" | "Moderate" | "High" | "Extreme";
export function heatRisk(maxTemp: number, a: Assumptions): HeatRisk {
  if (maxTemp > a.heatExtreme) return "Extreme";
  if (maxTemp >= a.heatHigh) return "High";
  if (maxTemp >= a.heatModerate) return "Moderate";
  return "Low";
}

export function reflectiveImpact(usable: number, a: Assumptions) {
  return { dropMin: 2, dropMax: 4, cost: usable * a.reflectiveCostPerM2 };
}

export function greenImpact(usable: number, a: Assumptions) {
  const area = usable * a.greenCoverage;
  return { area, cost: area * a.greenCostPerM2, co2: area * a.co2PerM2 };
}

export function rainwaterImpact(usable: number, rainfall: number, a: Assumptions) {
  return { litresYear: usable * rainfall * a.runoff };
}
