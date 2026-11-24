import type { Budget } from "./scoring";

export type Assumptions = {
  panelCoverage: number;
  m2PerKw: number;
  performance: number;
  tariff: number;
  costPerKw: number;
  monthlyKwh: number;
  subsidyPerKw: number;
  subsidyThirdKw: number;
  loanInterestPct: number;
  loanYears: number;
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
  subsidyPerKw: 30000,
  subsidyThirdKw: 18000,
  loanInterestPct: 7,
  loanYears: 10,
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
  subsidyPerKw: "Subsidy per kW for the first 2 kW (₹) — check the official PM Surya Ghar portal",
  subsidyThirdKw: "Subsidy for the third kW (₹)",
  loanInterestPct: "Loan interest (%)",
  loanYears: "Loan years",
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

/** Solar sized to a typical home's yearly use, capped by what the roof can hold (used when there is no roof outline). */
export function solarImpact(usable: number, irradiance: number, a: Assumptions) {
  const roofMaxKw = Math.max(0, (usable * a.panelCoverage) / a.m2PerKw);
  const demandKw = solarForKw(0, irradiance, a).demandKw;
  return { ...solarForKw(Math.min(roofMaxKw, demandKw), irradiance, a), roofMaxKw };
}

/** Generation, savings, cost and payback for a given system size in kW. */
export function solarForKw(kw: number, irradiance: number, a: Assumptions) {
  const yieldPerKw = irradiance * 365 * a.performance;
  const annualDemandKwh = a.monthlyKwh * 12;
  const demandKw = yieldPerKw > 0 ? annualDemandKwh / yieldPerKw : 0;
  const kwhYear = kw * yieldPerKw;
  const savings = kwhYear * a.tariff;
  const cost = kw * a.costPerKw;
  const subsidy = Math.min(cost, subsidyFor(kw, a));
  const netCost = cost - subsidy;
  return { kw, roofMaxKw: kw, demandKw, kwhYear, savings, cost, subsidy, netCost, payback: savings > 0 ? netCost / savings : Infinity };
}

/** System size from which the government subsidy stops growing. */
export const FULL_SUBSIDY_KW = 3;

/** Government subsidy for a system size: a per-kW amount for the first 2 kW, a smaller one for the third kW, nothing beyond 3 kW. */
export function subsidyFor(kw: number, a: Assumptions) {
  const k = Math.max(0, kw);
  return Math.min(k, 2) * a.subsidyPerKw + Math.min(Math.max(k - 2, 0), FULL_SUBSIDY_KW - 2) * a.subsidyThirdKw;
}

/** Equal monthly instalment for a loan at a yearly interest rate (%), repaid over the given years. */
export function loanEmi(principal: number, ratePct: number, years: number) {
  const n = Math.round(years * 12);
  if (!(principal > 0) || n <= 0) return 0;
  const r = ratePct / 1200;
  if (!(r > 0)) return principal / n;
  const g = Math.pow(1 + r, n);
  return (principal * r * g) / (g - 1);
}

export const PANEL_KW = 0.4;

/** Most a budget can spend on solar (₹); "Not sure" sets no limit. */
export const BUDGET_LIMIT: Record<Budget, number> = {
  low: 50000,
  medium: 150000,
  high: 500000,
  unsure: Infinity,
};

export type SolarLimit = "roof" | "need" | "budget";

/**
 * Recommended system in whole 400 W panels, never more than the roof fits and at least 1 when it fits any.
 * Low/Medium/High: what the budget buys (not capped at a typical home's need).
 * "Not sure" or no answer: a typical home's need.
 */
export function recommendSolar(roofMaxKw: number, irradiance: number, budget: Budget | undefined, a: Assumptions) {
  const eps = 1e-9;
  const whole = (kw: number) => Math.max(0, Math.floor(kw / PANEL_KW + eps));
  const roofPanels = whole(roofMaxKw);
  const needKw = solarForKw(0, irradiance, a).demandKw;
  const needPanels = whole(needKw);
  const limit = budget ? BUDGET_LIMIT[budget] : Infinity;
  const budgetKw = a.costPerKw > 0 ? limit / a.costPerKw : Infinity;
  const byBudget = isFinite(limit) && isFinite(budgetKw);
  const want = Math.max(1, byBudget ? whole(budgetKw) : needPanels);
  const panels = Math.min(roofPanels, want);
  const limitedBy: SolarLimit = want > roofPanels ? "roof" : byBudget ? "budget" : "need";
  return { panels, kw: panels * PANEL_KW, roofPanels, roofMaxKw, needKw, needPanels, budgetKw, limitedBy };
}

/** Panel count after one press of the cost stepper: one panel up or down, never below 1 or above what the roof fits. */
export function stepPanels(panels: number, dir: 1 | -1, roofPanels: number) {
  return Math.max(1, Math.min(roofPanels, panels + dir));
}

export type ProjectionYear = { year: number; kwh: number; savings: number; cumulativeNet: number };

/** 25-year cash flow: degrading output, rising tariff, yearly maintenance, upfront cost minus subsidy. */
export function solarProjection(kwhYear1: number, cost: number, a: Assumptions, subsidy = 0, years = 25) {
  const maintenance = cost * (a.maintenancePct / 100);
  let cumulative = -(cost - subsidy);
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
  return { rows, startNet: -(cost - subsidy), breakEvenYear, netSaving: cumulative, totalMwh: totalKwh / 1000 };
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
