import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { CostDatabaseService } from "../cost-database/service";
import { round2 } from "../estimate-engine/formulas";
import { pageCatalogRows, type CatalogPage, type CatalogQuery } from "../shared/catalog-query";
import {
  AddAssemblyItemInput,
  AssemblyDTO,
  AssemblyItemDTO,
  AssemblyUnitCostResult,
  CreateAssemblyInput,
  UpdateAssemblyInput,
} from "./types";

// Assemblies Database module: composes multiple cost items (and, recursively,
// other assemblies) into a single sellable unit. Pricing is never duplicated;
// assemblies reference the canonical Costbook records and resolve current unit
// cost only when a caller explicitly asks for it.
export class AssembliesDatabaseService {
  private readonly costDatabase = new CostDatabaseService();

  async list(orgId: string): Promise<AssemblyDTO[]> {
    const rows = await prisma.assembly.findMany({ where: { orgId }, orderBy: { name: "asc" } });
    return rows.map(toDTO);
  }

  async listPage(orgId: string, query: CatalogQuery): Promise<CatalogPage<AssemblyDTO>> {
    query = { ...query, scope: orgId };
    return this.pageAssemblies(query, { orgId });
  }

  async search(query: string, orgId: string): Promise<AssemblyDTO[]> {
    const rows = await prisma.assembly.findMany({
      where: {
        orgId,
        isActive: true,
        OR: [{ name: { contains: query, mode: "insensitive" } }, { code: { contains: query, mode: "insensitive" } }],
      },
      orderBy: { name: "asc" },
      take: 50,
    });
    return rows.map(toDTO);
  }

  /** Common starting-point assemblies an org has marked for quick reuse on estimates. */
  async listTemplates(orgId: string): Promise<AssemblyDTO[]> {
    const rows = await prisma.assembly.findMany({
      where: { orgId, isTemplate: true, isActive: true },
      orderBy: { name: "asc" },
    });
    return rows.map(toDTO);
  }

  async listTemplatesPage(orgId: string, query: CatalogQuery): Promise<CatalogPage<AssemblyDTO>> {
    query = { ...query, scope: orgId };
    return this.pageAssemblies(query, { orgId, isTemplate: true, isActive: true });
  }

  private async pageAssemblies(
    query: CatalogQuery,
    baseWhere: Record<string, unknown>
  ): Promise<CatalogPage<AssemblyDTO>> {
    const where = {
      ...baseWhere,
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { code: { contains: query.q, mode: "insensitive" } }, { description: { contains: query.q, mode: "insensitive" } }] } : {}),
      ...(query.filters.active !== undefined ? { isActive: query.filters.active } : {}),
      ...(query.filters.isTemplate !== undefined ? { isTemplate: query.filters.isTemplate } : {}),
    };
    const field = catalogField(query.sort, { code: "code", name: "name", createdAt: "createdAt", updatedAt: "updatedAt" });
    return pageCatalogRows<any>({
      query,
      where,
      cursorField: field,
      cursorValueType: field === "createdAt" || field === "updatedAt" ? "date" : "string",
      findMany: (args) => prisma.assembly.findMany(args as any) as any,
      count: (args) => prisma.assembly.count(args as any),
      getCursorValue: (row) => row[field],
      getId: (row) => row.id,
      map: (row) => toDTO(row),
    }) as Promise<CatalogPage<AssemblyDTO>>;
  }

  async getById(id: string, orgId: string): Promise<AssemblyDTO> {
    const row = await prisma.assembly.findFirst({ where: { id, orgId } });
    if (!row) throw new ApiError(404, `Assembly ${id} not found`);
    return toDTO(row);
  }

  async listAssemblyItems(assemblyId: string, orgId: string): Promise<AssemblyItemDTO[]> {
    await this.assertExists(assemblyId, orgId);
    const rows = await prisma.assemblyItem.findMany({
      where: { assemblyId, assembly: { orgId } },
      include: {
        costItem: { select: { code: true, name: true, unitOfMeasure: true } },
        childAssembly: { select: { code: true, name: true, unitOfMeasure: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });

    return rows.map((row) => {
      const component = row.costItem ?? row.childAssembly;
      if (!component) throw new ApiError(409, `AssemblyItem ${row.id} has no resolvable component`);
      return {
        id: row.id,
        assemblyId: row.assemblyId,
        costItemId: row.costItemId,
        childAssemblyId: row.childAssemblyId,
        quantityPerUnit: Number(row.quantityPerUnit),
        sortOrder: row.sortOrder,
        componentType: row.costItemId ? "cost_item" : "assembly",
        componentCode: component.code,
        componentName: component.name,
        componentUnitOfMeasure: component.unitOfMeasure,
      };
    });
  }

  async listAssemblyItemsPage(assemblyId: string, orgId: string, query: CatalogQuery): Promise<CatalogPage<AssemblyItemDTO>> {
    query = { ...query, scope: orgId };
    await this.assertExists(assemblyId, orgId);
    const where = { assemblyId, assembly: { orgId } };
    return pageCatalogRows<any>({
      query,
      where,
      cursorField: "sortOrder",
      cursorValueType: "number",
      findMany: (args) => prisma.assemblyItem.findMany(args as any) as any,
      count: (args) => prisma.assemblyItem.count(args as any),
      getCursorValue: (row) => row.sortOrder,
      getId: (row) => row.id,
      map: (row) => toAssemblyItemDTO(row),
      include: {
        include: {
          costItem: { select: { code: true, name: true, unitOfMeasure: true } },
          childAssembly: { select: { code: true, name: true, unitOfMeasure: true } },
        },
      },
    }) as Promise<CatalogPage<AssemblyItemDTO>>;
  }

  async create(input: CreateAssemblyInput): Promise<AssemblyDTO> {
    const row = await prisma.assembly.create({
      data: {
        orgId: input.orgId,
        code: input.code,
        name: input.name,
        unitOfMeasure: input.unitOfMeasure,
        description: input.description,
        isTemplate: input.isTemplate ?? false,
      },
    });
    return toDTO(row);
  }

  async update(id: string, input: UpdateAssemblyInput, orgId: string): Promise<AssemblyDTO> {
    await this.assertExists(id, orgId);
    const row = await prisma.assembly.update({
      where: { id },
      data: {
        code: input.code,
        name: input.name,
        isTemplate: input.isTemplate,
        unitOfMeasure: input.unitOfMeasure,
        description: input.description,
        isActive: input.isActive,
      },
    });
    return toDTO(row);
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.assertExists(id, orgId);
    await prisma.assembly.update({ where: { id }, data: { isActive: false } });
  }

  async addAssemblyItem(input: AddAssemblyItemInput): Promise<AssemblyItemDTO> {
    if (!input.costItemId && !input.childAssemblyId) {
      throw new ApiError(400, "Either costItemId or childAssemblyId is required");
    }
    if (input.costItemId && input.childAssemblyId) {
      throw new ApiError(400, "Provide exactly one of costItemId or childAssemblyId, not both");
    }
    await this.assertExists(input.assemblyId, input.orgId);
    if (input.costItemId) {
      const costItem = await prisma.costItem.findFirst({ where: { id: input.costItemId, orgId: input.orgId, isActive: true } });
      if (!costItem) throw new ApiError(404, `Active CostItem ${input.costItemId} not found`);
    }
    if (input.childAssemblyId) {
      const child = await prisma.assembly.findFirst({ where: { id: input.childAssemblyId, orgId: input.orgId, isActive: true } });
      if (!child) throw new ApiError(404, `Active Assembly ${input.childAssemblyId} not found`);
      await this.assertNoCycle(input.assemblyId, input.childAssemblyId, input.orgId);
    }
    const created = await prisma.assemblyItem.create({
      data: {
        assemblyId: input.assemblyId,
        costItemId: input.costItemId,
        childAssemblyId: input.childAssemblyId,
        quantityPerUnit: input.quantityPerUnit,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    const exact = (await this.listAssemblyItems(input.assemblyId, input.orgId)).find((item) => item.id === created.id);
    if (!exact) throw new ApiError(409, "Assembly component could not be reconciled after insert");
    return exact;
  }

  async removeAssemblyItem(assemblyItemId: string, orgId: string): Promise<void> {
    const row = await prisma.assemblyItem.findFirst({ where: { id: assemblyItemId, assembly: { orgId } } });
    if (!row) throw new ApiError(404, `AssemblyItem ${assemblyItemId} not found`);
    await prisma.assemblyItem.delete({ where: { id: assemblyItemId } });
  }

  /** Recursively resolves the current unit cost without mutating the assembly. */
  async getAssemblyUnitCost(
    assemblyId: string,
    regionId: string | undefined,
    visited: Set<string> = new Set(),
    orgId: string
  ): Promise<AssemblyUnitCostResult> {
    if (!orgId) throw new ApiError(400, "Organization context is required for assembly pricing");
    if (visited.has(assemblyId)) {
      throw new ApiError(409, `Circular assembly reference detected at assembly ${assemblyId}`);
    }
    const path = new Set(visited);
    path.add(assemblyId);
    await this.assertExists(assemblyId, orgId);

    const items = await prisma.assemblyItem.findMany({
      where: { assemblyId, assembly: { orgId } },
      orderBy: { sortOrder: "asc" },
    });
    let unitCost = 0;

    for (const item of items) {
      const qty = Number(item.quantityPerUnit);
      if (item.costItemId) {
        const breakdown = await this.costDatabase.getUnitCost(item.costItemId, 1, regionId, orgId);
        unitCost += breakdown.totalUnitCost * qty;
      } else if (item.childAssemblyId) {
        const child = await this.getAssemblyUnitCost(item.childAssemblyId, regionId, path, orgId);
        unitCost += child.unitCost * qty;
      }
    }

    return { unitCost: round2(unitCost), componentCount: items.length };
  }

  private async assertNoCycle(assemblyId: string, proposedChildId: string, orgId: string): Promise<void> {
    if (assemblyId === proposedChildId) {
      throw new ApiError(409, "An assembly cannot contain itself");
    }
    const stack = [proposedChildId];
    const seen = new Set<string>();
    while (stack.length) {
      const current = stack.pop() as string;
      if (seen.has(current)) continue;
      seen.add(current);
      const children = await prisma.assemblyItem.findMany({
        where: { assemblyId: current, childAssemblyId: { not: null }, assembly: { orgId } },
        select: { childAssemblyId: true },
      });
      for (const child of children) {
        if (child.childAssemblyId === assemblyId) {
          throw new ApiError(409, "Adding this child assembly would create a circular reference");
        }
        if (child.childAssemblyId) stack.push(child.childAssemblyId);
      }
    }
  }

  private async assertExists(id: string, orgId: string): Promise<void> {
    const exists = await prisma.assembly.findFirst({ where: { id, orgId } });
    if (!exists) throw new ApiError(404, `Assembly ${id} not found`);
  }
}

function toDTO(row: {
  id: string;
  orgId: string | null;
  code: string;
  name: string;
  unitOfMeasure: string;
  description: string | null;
  isTemplate: boolean;
  isActive: boolean;
}): AssemblyDTO {
  return row;
}

function toAssemblyItemDTO(row: {
  id: string;
  assemblyId: string;
  costItemId: string | null;
  childAssemblyId: string | null;
  quantityPerUnit: unknown;
  sortOrder: number;
  costItem?: { code: string; name: string; unitOfMeasure: string } | null;
  childAssembly?: { code: string; name: string; unitOfMeasure: string } | null;
}): AssemblyItemDTO {
  const component = row.costItem ?? row.childAssembly;
  if (!component) throw new ApiError(409, `AssemblyItem ${row.id} has no resolvable component`);
  return {
    id: row.id,
    assemblyId: row.assemblyId,
    costItemId: row.costItemId,
    childAssemblyId: row.childAssemblyId,
    quantityPerUnit: Number(row.quantityPerUnit),
    sortOrder: row.sortOrder,
    componentType: row.costItemId ? "cost_item" : "assembly",
    componentCode: component.code,
    componentName: component.name,
    componentUnitOfMeasure: component.unitOfMeasure,
  };
}

function catalogField(sort: string, allowed: Record<string, string>): string {
  const field = allowed[sort];
  if (!field) throw new ApiError(400, `Unsupported catalog sort field: ${sort}`);
  return field;
}
