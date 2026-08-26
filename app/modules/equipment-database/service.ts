import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { equipmentCost, equipmentHourlyCost } from "../estimate-engine/formulas";
import {
  CalculateEquipmentCostInput,
  CalculateEquipmentCostOutput,
  CreateEquipmentInput,
  EquipmentDTO,
  UpdateEquipmentInput,
} from "./types";

// Equipment Database module: ownership vs. operating cost models, hourly/daily
// rates (Deliverable 4 — equipment table). Distinguishes owned equipment
// (ownership + operating cost per hour) from rented equipment (flat daily_rate).
export class EquipmentDatabaseService {
  async list(orgId?: string): Promise<EquipmentDTO[]> {
    const rows = await prisma.equipment.findMany({
      where: orgId ? { orgId } : undefined,
      orderBy: { name: "asc" },
    });
    return rows.map(toDTO);
  }

  async getById(id: string, orgId?: string): Promise<EquipmentDTO> {
    const row = await prisma.equipment.findFirst({ where: { id, orgId } });
    if (!row) throw new ApiError(404, `Equipment ${id} not found`);
    return toDTO(row);
  }

  async create(input: CreateEquipmentInput): Promise<EquipmentDTO> {
    const row = await prisma.equipment.create({
      data: {
        orgId: input.orgId,
        name: input.name,
        ownershipCostPerHour: input.ownershipCostPerHour ?? 0,
        operatingCostPerHour: input.operatingCostPerHour ?? 0,
        dailyRate: input.dailyRate,
      },
    });
    return toDTO(row);
  }

  async update(id: string, input: UpdateEquipmentInput, orgId?: string): Promise<EquipmentDTO> {
    await this.assertExists(id, orgId);
    const row = await prisma.equipment.update({
      where: { id },
      data: {
        name: input.name,
        ownershipCostPerHour: input.ownershipCostPerHour,
        operatingCostPerHour: input.operatingCostPerHour,
        dailyRate: input.dailyRate,
      },
    });
    return toDTO(row);
  }

  async delete(id: string, orgId?: string): Promise<void> {
    await this.assertExists(id, orgId);
    await prisma.equipment.delete({ where: { id } });
  }

  /** Calculates equipment cost for a usage duration, choosing between hourly ownership+operating cost and a flat daily rate. */
  async calculateEquipmentCost(input: CalculateEquipmentCostInput, orgId?: string): Promise<CalculateEquipmentCostOutput> {
    const equipment = await prisma.equipment.findFirst({ where: { id: input.equipmentId, orgId } });
    if (!equipment) throw new ApiError(404, `Equipment ${input.equipmentId} not found`);

    const dailyRate = equipment.dailyRate != null ? Number(equipment.dailyRate) : undefined;
    const useDailyRate = input.useDailyRate ?? dailyRate != null;

    const totalCost = equipmentCost({
      hours: input.hours,
      ownershipCostPerHour: Number(equipment.ownershipCostPerHour),
      operatingCostPerHour: Number(equipment.operatingCostPerHour),
      dailyRate: useDailyRate ? dailyRate : undefined,
      billableHoursPerDay: input.billableHoursPerDay,
    });

    return {
      hourlyCost: equipmentHourlyCost(Number(equipment.ownershipCostPerHour), Number(equipment.operatingCostPerHour)),
      totalCost,
      pricedAs: useDailyRate && dailyRate != null ? "daily" : "hourly",
    };
  }

  private async assertExists(id: string, orgId?: string): Promise<void> {
    const exists = await prisma.equipment.findFirst({ where: { id, orgId } });
    if (!exists) throw new ApiError(404, `Equipment ${id} not found`);
  }
}

function toDTO(row: {
  id: string;
  orgId: string | null;
  name: string;
  ownershipCostPerHour: unknown;
  operatingCostPerHour: unknown;
  dailyRate: unknown;
}): EquipmentDTO {
  const ownership = Number(row.ownershipCostPerHour);
  const operating = Number(row.operatingCostPerHour);
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    ownershipCostPerHour: ownership,
    operatingCostPerHour: operating,
    dailyRate: row.dailyRate != null ? Number(row.dailyRate) : null,
    hourlyCost: equipmentHourlyCost(ownership, operating),
  };
}
