export interface CreateEquipmentInput {
  orgId?: string;
  name: string;
  ownershipCostPerHour?: number;
  operatingCostPerHour?: number;
  dailyRate?: number;
}

export type UpdateEquipmentInput = Partial<CreateEquipmentInput>;

export interface EquipmentDTO {
  id: string;
  orgId: string | null;
  name: string;
  ownershipCostPerHour: number;
  operatingCostPerHour: number;
  dailyRate: number | null;
  hourlyCost: number;
}

export interface CalculateEquipmentCostInput {
  equipmentId: string;
  hours: number;
  billableHoursPerDay?: number;
  useDailyRate?: boolean;
}

export interface CalculateEquipmentCostOutput {
  hourlyCost: number;
  totalCost: number;
  pricedAs: "hourly" | "daily";
}
