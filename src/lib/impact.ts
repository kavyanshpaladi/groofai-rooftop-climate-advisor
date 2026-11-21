export type Assumptions = {
  panelCoverage: number;
  m2PerKw: number;
  performance: number;
  tariff: number;
  costPerKw: number;
  reflectiveCostPerM2: number;
  greenCoverage: number;
  greenCostPerM2: number;
  co2PerM2: number;
  runoff: number;
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  panelCoverage: 0.6,
  m2PerKw: 6.5,
  performance: 0.75,
  tariff: 7,
  costPerKw: 55000,
  reflectiveCostPerM2: 60,
  greenCoverage: 0.7,
  greenCostPerM2: 1200,
  co2PerM2: 2,
  runoff: 0.8,
};

export const ASSUMPTION_LABELS: Record<keyof Assumptions, string> = {
  panelCoverage: "Share of usable area with panels",
  m2PerKw: "Roof area per kW (m²)",
  performance: "System performance ratio",
  tariff: "Electricity tariff (₹/kWh)",
  costPerKw: "Solar cost (₹/kW)",
  reflectiveCostPerM2: "Reflective coating cost (₹/m²)",
  greenCoverage: "Share of usable area planted",
  greenCostPerM2: "Green roof cost (₹/m²)",
  co2PerM2: "CO₂ offset (kg/m²/yr)",
  runoff: "Rainwater collection efficiency",
};

export function solarImpact(usable: number, irradiance: number, a: Assumptions) {
  const kw = (usable * a.panelCoverage) / a.m2PerKw;
  const kwhYear = kw * irradiance * 365 * a.performance;
  const savings = kwhYear * a.tariff;
  const cost = kw * a.costPerKw;
  return { kw, kwhYear, savings, cost, payback: savings > 0 ? cost / savings : Infinity };
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
