// Pure pricing formulas shared across modules (Cost Database, Assemblies, Estimate Engine).
// Mirrors Deliverable 3 ("Estimating Formula Engine") of the Architecture planning document.
// Kept dependency-free (no Prisma, no I/O) so it can be unit tested in isolation.

export interface LaborInput {
  quantity: number;
  productionRate: number; // units of work per labor-hour
  baseHourlyRate: number;
  burdenPct: number; // e.g. 25 = 25%
  regionLaborIndex?: number; // multiplier, defaults to 1
}

export interface MaterialInput {
  quantity: number;
  unitCost: number;
  wasteFactorPct: number; // e.g. 10 = 10%
  regionMaterialIndex?: number; // multiplier, defaults to 1
}

export interface EquipmentInput {
  hours: number;
  ownershipCostPerHour: number;
  operatingCostPerHour: number;
  dailyRate?: number; // if set and hours fit within one billable day, may be used instead
  billableHoursPerDay?: number; // defaults to 8
}

export function burdenedLaborRate(baseHourlyRate: number, burdenPct: number, regionLaborIndex = 1): number {
  return baseHourlyRate * (1 + burdenPct / 100) * regionLaborIndex;
}

export function laborHours(quantity: number, productionRate: number): number {
  if (productionRate <= 0) {
    throw new Error("productionRate must be greater than zero");
  }
  return quantity / productionRate;
}

export function laborCost(input: LaborInput): number {
  const hours = laborHours(input.quantity, input.productionRate);
  const rate = burdenedLaborRate(input.baseHourlyRate, input.burdenPct, input.regionLaborIndex ?? 1);
  return round2(hours * rate);
}

export function adjustedMaterialCost(input: MaterialInput): number {
  const regionIndex = input.regionMaterialIndex ?? 1;
  const base = input.quantity * input.unitCost * regionIndex;
  return round2(base * (1 + input.wasteFactorPct / 100));
}

export function equipmentHourlyCost(ownershipCostPerHour: number, operatingCostPerHour: number): number {
  return ownershipCostPerHour + operatingCostPerHour;
}

export function equipmentCost(input: EquipmentInput): number {
  const billableHoursPerDay = input.billableHoursPerDay ?? 8;
  if (input.dailyRate != null && input.hours >= billableHoursPerDay) {
    const days = Math.ceil(input.hours / billableHoursPerDay);
    return round2(days * input.dailyRate);
  }
  return round2(input.hours * equipmentHourlyCost(input.ownershipCostPerHour, input.operatingCostPerHour));
}

export type PricingMode = "markup" | "targetMargin";

export interface ProfitInput {
  totalCost: number;
  mode: PricingMode;
  /** Markup %, e.g. 20 = 20% markup, used when mode === "markup" */
  markupPct?: number;
  /** Target margin %, e.g. 25 = 25% margin, used when mode === "targetMargin" */
  targetMarginPct?: number;
}

export function sellPrice(input: ProfitInput): number {
  if (input.mode === "markup") {
    if (input.markupPct == null) throw new Error("markupPct is required when mode is 'markup'");
    return round2(input.totalCost * (1 + input.markupPct / 100));
  }
  if (input.targetMarginPct == null) throw new Error("targetMarginPct is required when mode is 'targetMargin'");
  if (input.targetMarginPct >= 100) throw new Error("targetMarginPct must be less than 100");
  return round2(input.totalCost / (1 - input.targetMarginPct / 100));
}

export function markupFromMargin(marginPct: number): number {
  if (marginPct >= 100) throw new Error("marginPct must be less than 100");
  return round2((marginPct / (100 - marginPct)) * 100);
}

export function marginFromMarkup(markupPct: number): number {
  return round2((markupPct / (100 + markupPct)) * 100);
}

export function applyOverhead(jobCost: number, directOverhead: number, indirectOverheadPct: number): number {
  const subtotal = jobCost + directOverhead;
  return round2(subtotal * (1 + indirectOverheadPct / 100));
}

/** Allocates estimate-wide customer pricing to taxable scope before applying tax. */
export function estimateTaxAmount(input: { preTaxTotalPrice: number; jobCost: number; taxableJobCost: number; taxPct: number }): number {
  if (input.jobCost <= 0 || input.taxPct <= 0 || input.taxableJobCost <= 0) return 0;
  const taxablePrice = round2(input.preTaxTotalPrice * (input.taxableJobCost / input.jobCost));
  return round2(taxablePrice * (input.taxPct / 100));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
