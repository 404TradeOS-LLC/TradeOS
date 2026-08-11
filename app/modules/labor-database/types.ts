export interface CreateLaborRateInput {
  orgId: string;
  trade: string;
  baseHourlyRate: number;
  burdenPct?: number;
  regionId?: string;
}

export type UpdateLaborRateInput = Partial<CreateLaborRateInput>;

export interface LaborRateDTO {
  id: string;
  orgId: string | null;
  trade: string;
  baseHourlyRate: number;
  burdenPct: number;
  regionId: string | null;
  burdenedRate: number;
}

export interface CalculateLaborCostInput {
  laborRateId: string;
  quantity: number;
  productionRate: number;
}

export interface CalculateLaborCostOutput {
  laborHours: number;
  burdenedRate: number;
  laborCost: number;
}
