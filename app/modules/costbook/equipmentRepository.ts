import { ApiError } from "../../backend/middleware/errorHandler";
import { prisma } from "../../db/client";
import { pageCatalogRows, type CatalogPage, type CatalogQuery } from "../shared/catalog-query";
import type { CostbookEquipmentInput, CostbookEquipmentRecord, CostbookEquipmentUpdateInput } from "./types";

export class CostbookEquipmentRepository {
  async list(organizationId: string): Promise<CostbookEquipmentRecord[]> {
    const rows = await prisma.equipment.findMany({
      where: { orgId: organizationId },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toEquipmentRecord);
  }

  async listPage(organizationId: string, query: CatalogQuery): Promise<CatalogPage<CostbookEquipmentRecord>> {
    query = { ...query, scope: organizationId };
    const where = {
      orgId: organizationId,
      ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
    };
    const field = catalogField(query.sort, { name: "name", createdAt: "createdAt", updatedAt: "updatedAt" });
    return pageCatalogRows<any>({
      query,
      where,
      cursorField: field,
      cursorValueType: field === "createdAt" || field === "updatedAt" ? "date" : "string",
      findMany: (args) => prisma.equipment.findMany(args as any) as any,
      count: (args) => prisma.equipment.count(args as any),
      getCursorValue: (row) => row[field],
      getId: (row) => row.id,
      map: (row) => toEquipmentRecord(row),
    }) as Promise<CatalogPage<CostbookEquipmentRecord>>;
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

function catalogField(sort: string, allowed: Record<string, string>): string {
  const field = allowed[sort];
  if (!field) throw new ApiError(400, `Unsupported catalog sort field: ${sort}`);
  return field;
}
