import { ApiError } from "../../backend/middleware/errorHandler";
import { prisma } from "../../db/client";
import type { CostbookEquipmentInput, CostbookEquipmentRecord, CostbookEquipmentUpdateInput } from "./types";

export class CostbookEquipmentRepository {
  async list(organizationId: string): Promise<CostbookEquipmentRecord[]> {
    const rows = await prisma.equipment.findMany({
      where: { orgId: organizationId },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toEquipmentRecord);
  }

  async getById(organizationId: string, id: string): Promise<CostbookEquipmentRecord | null> {
    const row = await prisma.equipment.findFirst({ where: { id, orgId: organizationId } });
    return row ? toEquipmentRecord(row) : null;
  }

  async create(organizationId: string, input: CostbookEquipmentInput): Promise<CostbookEquipmentRecord> {
    const row = await prisma.equipment.create({
      data: {
        orgId: organizationId,
        name: input.name,
        ownershipCostPerHour: input.ownershipCostPerHour,
        operatingCostPerHour: input.operatingCostPerHour,
        dailyRate: input.dailyRate ?? null,
      },
    });
    return toEquipmentRecord(row);
  }

  async update(
    organizationId: string,
    id: string,
    input: CostbookEquipmentUpdateInput
  ): Promise<CostbookEquipmentRecord | null> {
    const existing = await prisma.equipment.findFirst({ where: { id, orgId: organizationId } });
    if (!existing) return null;

    const row = await prisma.equipment.update({
      where: { id },
      data: {
        name: input.name,
        ownershipCostPerHour: input.ownershipCostPerHour,
        operatingCostPerHour: input.operatingCostPerHour,
        dailyRate: input.dailyRate === undefined ? undefined : input.dailyRate,
      },
    });
    return toEquipmentRecord(row);
  }

  async remove(organizationId: string, id: string): Promise<boolean> {
    const existing = await prisma.equipment.findFirst({ where: { id, orgId: organizationId } });
    if (!existing) return false;
    await prisma.equipment.delete({ where: { id } });
    return true;
  }
}

function toEquipmentRecord(row: {
  id: string;
  orgId: string | null;
  name: string;
  ownershipCostPerHour: unknown;
  operatingCostPerHour: unknown;
  dailyRate: unknown;
  createdAt: Date;
  updatedAt: Date;
}): CostbookEquipmentRecord {
  if (!row.orgId) {
    throw new ApiError(500, "Costbook equipment is missing organization scope");
  }

  const ownershipCostPerHour = Number(row.ownershipCostPerHour);
  const operatingCostPerHour = Number(row.operatingCostPerHour);

  return {
    id: row.id,
    organizationId: row.orgId,
    name: row.name,
    ownershipCostPerHour,
    operatingCostPerHour,
    dailyRate: row.dailyRate != null ? Number(row.dailyRate) : null,
    hourlyCost: (Math.round(ownershipCostPerHour * 100) + Math.round(operatingCostPerHour * 100)) / 100,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
