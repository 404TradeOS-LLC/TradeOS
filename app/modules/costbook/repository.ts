import { prisma } from "../../db/client";
import type { CostbookInventoryCounts, CostbookWorkspaceRecord } from "./types";

export class CostbookRepository {
  async getWorkspace(organizationId: string): Promise<CostbookWorkspaceRecord | null> {
    const row = await prisma.costbookWorkspace.findUnique({
      where: { organizationId },
    });

    return row
      ? {
          id: row.id,
          organizationId: row.organizationId,
          status: row.status as CostbookWorkspaceRecord["status"],
          setupState: toRecord(row.setupState),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }
      : null;
  }

  async getInventoryCounts(organizationId: string): Promise<CostbookInventoryCounts> {
    const [categories, costItems, laborRates, materials, equipment, assemblies] = await Promise.all([
      prisma.division.count({ where: { orgId: organizationId } }),
      prisma.costItem.count({ where: { orgId: organizationId, isActive: true } }),
      prisma.laborRate.count({ where: { orgId: organizationId } }),
      prisma.material.count({ where: { orgId: organizationId } }),
      prisma.equipment.count({ where: { orgId: organizationId } }),
      prisma.assembly.count({ where: { orgId: organizationId, isActive: true } }),
    ]);

    return { categories, costItems, laborRates, materials, equipment, assemblies };
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
