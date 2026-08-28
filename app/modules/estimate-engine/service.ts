import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import { ApiError } from "../../backend/middleware/errorHandler";
import { CostDatabaseService } from "../cost-database/service";
import { AssembliesDatabaseService } from "../assemblies-database/service";
import { getDefaultAthenaEventService } from "../athena-events/service";
import { applyOverhead, estimateTaxAmount, sellPrice, round2 } from "./formulas";
import { canTransitionEstimateStatus, legacyEstimateStatusMap, normalizeEstimateStatus } from "../../domain";
import { clampQueueLimit, decodeUpdatedAtCursor, encodeUpdatedAtCursor, buildUpdatedAtRange, QueuePage } from "../shared/pagination";
import { expandCanonicalStatusFilter } from "../shared/statusFilter";
import {
  AddLineItemInput,
  CreateEstimateInput,
  EstimateComparisonDTO,
  EstimateDTO,
  EstimateLineItemDTO,
  EstimateQueueFilters,
  EstimateQueueItemDTO,
  EstimateCostType,
  UpdateEstimateInput,
  UpdateLineItemInput,
  SetPricingModeInput,
} from "./types";

export interface EstimateEventRef {
  type: string;
  id: string;
}

export class EstimateEngineService {
  private readonly costDatabase = new CostDatabaseService();
  private readonly assembliesDatabase = new AssembliesDatabaseService();

  async create(input: CreateEstimateInput): Promise<EstimateDTO & { athenaEvent?: EstimateEventRef }> {
    const project = await prisma.project.findFirst({ where: { id: input.projectId, orgId: input.orgId } });
    if (!project) throw new ApiError(404, `Project ${input.projectId} not found`);

    if (input.orgId && typeof prisma.$queryRaw === "function") {
      await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        select id
        from projects
        where id = cast(${input.projectId} as uuid)
          and org_id = cast(${input.orgId} as uuid)
        for update
      `);
    }
    const priorVersions = await prisma.estimate.count({ where: { projectId: input.projectId } });
    const row = await prisma.estimate.create({
      data: {
        orgId: input.orgId,
        projectId: input.projectId,
        version: priorVersions + 1,
        overheadPct: input.overheadPct ?? 0,
      },
    });
    const athenaEvent = await this.publishEstimateEvent(input.orgId, "EstimateStarted", row.id, `estimate:${row.id}:started:v1`, { projectId: row.projectId, version: row.version });
    return { ...toEstimateDTO(row), athenaEvent };
  }

  private async publishEstimateEvent(orgId: string | undefined, type: string, estimateId: string, idempotencyKey: string, payload: unknown): Promise<EstimateEventRef | undefined> {
    if (!orgId) return undefined;
    try {
      const { event } = await getDefaultAthenaEventService().publish({
        orgId,
        type,
        version: "1.0.0",
        entity: { type: "estimate", id: estimateId },
        actor: { type: "system", id: null },
        payload,
        correlationId: randomUUID(),
        idempotencyKey,
      });
      return { type: event.type, id: event.id };
    } catch (error) {
      console.error(`[athena-events] failed to publish ${type} event`, error);
      return undefined;
    }
  }

  async getById(id: string, orgId?: string): Promise<EstimateDTO & { lineItems: EstimateLineItemDTO[] }> {
    const row = await prisma.estimate.findFirst({ where: { id, orgId }, include: { lineItems: { orderBy: { sortOrder: "asc" } } } });
    if (!row) throw new ApiError(404, `Estimate ${id} not found`);
    return { ...toEstimateDTO(row), lineItems: row.lineItems.map(toLineItemDTO) };
  }

  async listByProject(projectId: string, orgId?: string): Promise<EstimateDTO[]> {
    const rows = await prisma.estimate.findMany({ where: { projectId, orgId }, orderBy: { version: "desc" } });
    return rows.map(toEstimateDTO);
  }

  /**
   * Organization-wide, newest-activity-first estimate queue. The canonical
   * Estimate model has no soft-delete/archive flag, so "not deleted" is
   * vacuously true for every row and no status is treated as an implicit
   * default-view exclusion — callers filter by `statuses` explicitly.
   */
  async listOrganizationQueue(filters: EstimateQueueFilters): Promise<QueuePage<EstimateQueueItemDTO>> {
    const limit = clampQueueLimit(filters.limit);
    const conditions: Prisma.EstimateWhereInput[] = [{ orgId: filters.orgId }];

    if (filters.statuses?.length) conditions.push({ status: { in: expandCanonicalStatusFilter(filters.statuses, legacyEstimateStatusMap) } });
    const updatedAtRange = buildUpdatedAtRange(filters);
    if (updatedAtRange) conditions.push({ updatedAt: updatedAtRange });

    // filterWhere excludes the cursor predicate so count() reflects the
    // exact total for the filter, not just rows remaining after the cursor
    // position — pageWhere adds the cursor on top of it for findMany only.
    const filterWhere: Prisma.EstimateWhereInput = { AND: conditions };
    let pageWhere = filterWhere;
    if (filters.cursor) {
      const cursor = decodeUpdatedAtCursor(filters.cursor);
      pageWhere = {
        AND: [
          ...conditions,
          { OR: [{ updatedAt: { lt: cursor.updatedAt } }, { AND: [{ updatedAt: cursor.updatedAt }, { id: { lt: cursor.id } }] }] },
        ],
      };
    }

    const [total, rows] = await Promise.all([
      prisma.estimate.count({ where: filterWhere }),
      prisma.estimate.findMany({
        where: pageWhere,
        include: { project: { include: { customer: { select: { name: true } } } } },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit,
      }),
    ]);

    const items = rows.map(toEstimateQueueItemDTO);
    const last = rows[rows.length - 1];
    const nextCursor = rows.length === limit && last ? encodeUpdatedAtCursor({ updatedAt: last.updatedAt, id: last.id }) : null;

    return { items, total, nextCursor };
  }

  async duplicateFromVersion(sourceEstimateId: string, orgId?: string): Promise<EstimateDTO & { lineItems: EstimateLineItemDTO[] }> {
    const source = await prisma.estimate.findFirst({
      where: { id: sourceEstimateId, orgId },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    if (!source) throw new ApiError(404, `Estimate ${sourceEstimateId} not found`);

    const priorVersions = await prisma.estimate.count({ where: { projectId: source.projectId } });
    const row = await prisma.estimate.create({
      data: {
        orgId: source.orgId,
        projectId: source.projectId,
        version: priorVersions + 1,
        status: "draft",
        overheadPct: source.overheadPct,
        profitPct: source.profitPct,
        targetMarginPct: source.targetMarginPct,
        subtotalCost: source.subtotalCost,
        totalPrice: source.totalPrice,
        taxPct: source.taxPct ?? 0,
        taxAmount: source.taxAmount ?? 0,
        lineItems: {
          create: source.lineItems.map((lineItem) => ({
            costItemId: lineItem.costItemId,
            assemblyId: lineItem.assemblyId,
            description: lineItem.description,
            quantity: lineItem.quantity,
            unitOfMeasure: lineItem.unitOfMeasure,
            unitCost: lineItem.unitCost,
            lineCost: lineItem.lineCost,
            sortOrder: lineItem.sortOrder,
            section: lineItem.section ?? "General",
            costType: lineItem.costType ?? "other",
            taxable: lineItem.taxable ?? false,
          })),
        },
      },
    });

    return this.getById(row.id, orgId);
  }

  async addLineItem(input: AddLineItemInput): Promise<EstimateLineItemDTO> {
    if (typeof prisma.$transaction !== "function") {
      return this.addLineItemInTransaction(input);
    }
    return runInDatabaseTransaction(prisma, () => this.addLineItemInTransaction(input));
  }

  private async addLineItemInTransaction(input: AddLineItemInput): Promise<EstimateLineItemDTO> {
    if (!input.orgId) throw new ApiError(400, "Organization context is required for estimate line-item mutations");
    await this.lockEstimateForMutation(input.estimateId, input.orgId);
    await this.assertDraft(input.estimateId, input.orgId);
    if (input.costItemId && input.assemblyId) {
      throw new ApiError(400, "Provide exactly one of costItemId or assemblyId, not both");
    }

    let unitOfMeasure: string = input.unitOfMeasure ?? "EA";
    let unitCost: number = input.unitCost ?? 0;
    let description = input.description ?? "";
    let costType: EstimateCostType = input.costType ?? "other";

    if (input.costItemId) {
      const item = await prisma.costItem.findFirst({ where: { id: input.costItemId, orgId: input.orgId } });
      if (!item) throw new ApiError(404, `CostItem ${input.costItemId} not found`);
      const breakdown = await this.costDatabase.getUnitCost(input.costItemId, input.quantity, undefined, input.orgId);
      unitOfMeasure = item.unitOfMeasure;
      unitCost = breakdown.totalUnitCost;
      description = description || item.name;
      costType = input.costType ?? inferCostType(item);
    } else {
      if (input.assemblyId) {
        const assembly = await prisma.assembly.findFirst({ where: { id: input.assemblyId, orgId: input.orgId } });
        if (!assembly) throw new ApiError(404, `Assembly ${input.assemblyId} not found`);
        const result = await this.assembliesDatabase.getAssemblyUnitCost(input.assemblyId, undefined, new Set(), input.orgId);
        unitOfMeasure = assembly.unitOfMeasure;
        unitCost = result.unitCost;
        description = description || assembly.name;
      } else if (!description.trim() || input.unitCost == null || !input.unitOfMeasure?.trim()) {
        throw new ApiError(400, "Custom estimate lines require description, unit of measure, and unit cost");
      }
    }

    const lineCost = round2(unitCost * input.quantity);
    const maxSortOrder = await prisma.estimateLineItem.aggregate({
      where: { estimateId: input.estimateId },
      _max: { sortOrder: true },
    });

    const data = {
      estimateId: input.estimateId,
      costItemId: input.costItemId,
      assemblyId: input.assemblyId,
      description,
      quantity: input.quantity,
      unitOfMeasure,
      unitCost,
      lineCost,
      sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
      section: input.section?.trim() || "General",
      costType,
      taxable: input.taxable ?? false,
      sourceKey: input.sourceKey,
    };

    if (input.sourceKey) {
      const created = await prisma.estimateLineItem.createMany({
        data,
        skipDuplicates: true,
      });
      const row = await prisma.estimateLineItem.findFirst({
        where: { estimateId: input.estimateId, sourceKey: input.sourceKey },
      });
      if (!row) throw new ApiError(409, "Estimate line item could not be reconciled after idempotent insert");

      if (created.count > 0) {
        await this.recalculate(input.estimateId, input.orgId);
      }
      return toLineItemDTO(row);
    }

    const row = await prisma.estimateLineItem.create({
      data: {
        ...data,
        sourceKey: undefined,
      },
    });

    await this.recalculate(input.estimateId, input.orgId);
    return toLineItemDTO(row);
  }

  async addLineItemAndRecalculate(input: AddLineItemInput): Promise<{ lineItem: EstimateLineItemDTO; estimate: EstimateDTO }> {
    return runInDatabaseTransaction(prisma, async () => {
      const lineItem = await this.addLineItem(input);
      const { lineItems: _lineItems, ...estimate } = await this.getById(input.estimateId, input.orgId);
      return { lineItem, estimate };
    });
  }

  async removeLineItem(lineItemId: string, orgId?: string, estimateId?: string): Promise<{ estimateId: string }> {
    const operation = () => this.removeLineItemInTransaction(lineItemId, orgId, estimateId);
    if (typeof prisma.$transaction !== "function") return operation();
    return runInDatabaseTransaction(prisma, operation);
  }

  private async removeLineItemInTransaction(lineItemId: string, orgId?: string, estimateId?: string): Promise<{ estimateId: string }> {
    const lineItem = await prisma.estimateLineItem.findUnique({ where: { id: lineItemId }, include: { estimate: true } });
    if (!lineItem) throw new ApiError(404, `EstimateLineItem ${lineItemId} not found`);
    if (orgId && lineItem.estimate.orgId !== orgId) throw new ApiError(404, `EstimateLineItem ${lineItemId} not found`);
    if (estimateId && lineItem.estimateId !== estimateId) throw new ApiError(404, `EstimateLineItem ${lineItemId} not found`);
    await this.lockEstimateForMutation(lineItem.estimateId, orgId);
    await this.assertDraft(lineItem.estimateId, orgId);
    await prisma.estimateLineItem.delete({ where: { id: lineItemId } });
    await this.recalculate(lineItem.estimateId, orgId);
    return { estimateId: lineItem.estimateId };
  }

  async updateLineItem(input: UpdateLineItemInput): Promise<EstimateLineItemDTO> {
    const operation = () => this.updateLineItemInTransaction(input);
    if (typeof prisma.$transaction !== "function") return operation();
    return runInDatabaseTransaction(prisma, operation);
  }

  private async updateLineItemInTransaction(input: UpdateLineItemInput): Promise<EstimateLineItemDTO> {
    const lineItem = await prisma.estimateLineItem.findUnique({ where: { id: input.lineItemId }, include: { estimate: true } });
    if (!lineItem) throw new ApiError(404, `EstimateLineItem ${input.lineItemId} not found`);
    if (lineItem.estimate.orgId !== input.orgId) throw new ApiError(404, `EstimateLineItem ${input.lineItemId} not found`);
    if (lineItem.estimateId !== input.estimateId) throw new ApiError(404, `EstimateLineItem ${input.lineItemId} not found`);
    await this.lockEstimateForMutation(lineItem.estimateId, input.orgId);
    await this.assertDraft(lineItem.estimateId, input.orgId);

    const quantity = input.quantity ?? Number(lineItem.quantity);
    const unitCost = input.unitCost ?? Number(lineItem.unitCost);
    const row = await prisma.estimateLineItem.update({
      where: { id: input.lineItemId },
      data: {
        description: input.description?.trim() || undefined,
        section: input.section?.trim() || undefined,
        costType: input.costType,
        unitOfMeasure: input.unitOfMeasure?.trim() || undefined,
        quantity,
        unitCost,
        lineCost: round2(quantity * unitCost),
        taxable: input.taxable,
      },
    });
    await this.recalculate(lineItem.estimateId, input.orgId);
    return toLineItemDTO(row);
  }

  async updateEstimate(input: UpdateEstimateInput): Promise<EstimateDTO> {
    const operation = () => this.updateEstimateInTransaction(input);
    if (typeof prisma.$transaction !== "function") return operation();
    return runInDatabaseTransaction(prisma, operation);
  }

  private async updateEstimateInTransaction(input: UpdateEstimateInput): Promise<EstimateDTO> {
    await this.lockEstimateForMutation(input.estimateId, input.orgId);
    await this.assertDraft(input.estimateId, input.orgId);
    await prisma.estimate.update({
      where: { id: input.estimateId },
      data: {
        overheadPct: input.overheadPct,
        taxPct: input.taxPct,
      },
    });
    return this.recalculate(input.estimateId, input.orgId);
  }

  async setPricingMode(input: SetPricingModeInput): Promise<EstimateDTO> {
    const operation = () => this.setPricingModeInTransaction(input);
    if (typeof prisma.$transaction !== "function") return operation();
    return runInDatabaseTransaction(prisma, operation);
  }

  private async setPricingModeInTransaction(input: SetPricingModeInput): Promise<EstimateDTO> {
    await this.lockEstimateForMutation(input.estimateId, input.orgId);
    await this.assertDraft(input.estimateId, input.orgId);
    await prisma.estimate.update({
      where: { id: input.estimateId },
      data: {
        profitPct: input.mode === "markup" ? input.markupPct ?? 0 : 0,
        targetMarginPct: input.mode === "targetMargin" ? input.targetMarginPct : null,
      },
    });
    return this.recalculate(input.estimateId, input.orgId);
  }

  async recalculate(estimateId: string, orgId?: string): Promise<EstimateDTO> {
    const estimate = await prisma.estimate.findFirst({ where: { id: estimateId, orgId }, include: { lineItems: true } });
    if (!estimate) throw new ApiError(404, `Estimate ${estimateId} not found`);

    const jobCost = estimate.lineItems.reduce((sum, li) => sum + Number(li.lineCost), 0);
    const totalCost = applyOverhead(jobCost, 0, Number(estimate.overheadPct));

    const preTaxTotalPrice =
      estimate.targetMarginPct != null
        ? sellPrice({ totalCost, mode: "targetMargin", targetMarginPct: Number(estimate.targetMarginPct) })
        : sellPrice({ totalCost, mode: "markup", markupPct: Number(estimate.profitPct) });
    const taxableCost = estimate.lineItems.reduce((sum, li) => sum + (li.taxable ? Number(li.lineCost) : 0), 0);
    const taxAmount = estimateTaxAmount({ preTaxTotalPrice, jobCost, taxableJobCost: taxableCost, taxPct: Number(estimate.taxPct ?? 0) });
    const totalPrice = round2(preTaxTotalPrice + taxAmount);

    const row = await prisma.estimate.update({
      where: { id: estimateId },
      data: { subtotalCost: round2(jobCost), totalPrice, taxAmount },
    });
    return toEstimateDTO(row);
  }

  async finalize(estimateId: string, orgId?: string): Promise<EstimateDTO & { athenaEvent?: EstimateEventRef }> {
    const operation = () => this.finalizeInTransaction(estimateId, orgId);
    if (typeof prisma.$transaction !== "function") return operation();
    return runInDatabaseTransaction(prisma, operation);
  }

  private async finalizeInTransaction(estimateId: string, orgId?: string): Promise<EstimateDTO & { athenaEvent?: EstimateEventRef }> {
    await this.lockEstimateForMutation(estimateId, orgId);
    await this.recalculate(estimateId, orgId);
    const estimate = await prisma.estimate.findFirst({ where: { id: estimateId, orgId } });
    if (!estimate) throw new ApiError(404, `Estimate ${estimateId} not found`);
    const currentStatus = normalizeEstimateStatus(estimate.status);
    if (!canTransitionEstimateStatus(currentStatus, "ready")) {
      throw new ApiError(409, `Estimate ${estimateId} cannot transition from ${currentStatus} to ready`);
    }
    const row = await prisma.estimate.update({ where: { id: estimateId }, data: { status: "ready" } });
    await prisma.proposal.updateMany({
      where: { estimateId: row.id, finalPrice: null, priceLow: null, priceHigh: null },
      data: { finalPrice: row.totalPrice },
    });
    const dto = toEstimateDTO(row);
    const athenaEvent = await this.publishEstimateEvent(orgId, "EstimateCompleted", row.id, `estimate:${row.id}:completed:v1`, { projectId: row.projectId, totalPrice: dto.totalPrice });
    return { ...dto, athenaEvent };
  }

  private async lockEstimateForMutation(estimateId: string, orgId?: string): Promise<void> {
    if (!orgId || typeof prisma.$queryRaw !== "function") return;
    await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM estimates
      WHERE id = CAST(${estimateId} AS uuid) AND org_id = CAST(${orgId} AS uuid)
      FOR UPDATE
    `);
  }

  private async assertDraft(estimateId: string, orgId?: string): Promise<void> {
    const estimate = await prisma.estimate.findFirst({ where: { id: estimateId, orgId } });
    if (!estimate) throw new ApiError(404, `Estimate ${estimateId} not found`);
    if (normalizeEstimateStatus(estimate.status) !== "draft") {
      throw new ApiError(409, `Estimate ${estimateId} is not in draft status and can no longer be modified`);
    }
  }

  async compareEstimates(baseEstimateId: string, candidateEstimateId: string, orgId?: string): Promise<EstimateComparisonDTO> {
    const [base, candidate] = await Promise.all([this.getById(baseEstimateId, orgId), this.getById(candidateEstimateId, orgId)]);
    const marginPct = (estimate: EstimateDTO): number => {
      return estimate.preTaxTotalPrice > 0 ? round2(((estimate.preTaxTotalPrice - estimate.costAfterOverhead) / estimate.preTaxTotalPrice) * 100) : 0;
    };

    return {
      base: { id: base.id, version: base.version, subtotalCost: base.subtotalCost, totalPrice: base.totalPrice, marginPct: marginPct(base), lineItemCount: base.lineItems.length },
      candidate: { id: candidate.id, version: candidate.version, subtotalCost: candidate.subtotalCost, totalPrice: candidate.totalPrice, marginPct: marginPct(candidate), lineItemCount: candidate.lineItems.length },
      delta: {
        subtotalCost: round2(candidate.subtotalCost - base.subtotalCost),
        totalPrice: round2(candidate.totalPrice - base.totalPrice),
        marginPct: round2(marginPct(candidate) - marginPct(base)),
        lineItemCount: candidate.lineItems.length - base.lineItems.length,
      },
    };
  }
}

export function toEstimateDTO(row: {
  id: string;
  orgId: string | null;
  projectId: string;
  version: number;
  status: string;
  overheadPct: unknown;
  profitPct: unknown;
  targetMarginPct: unknown;
  subtotalCost: unknown;
  totalPrice: unknown;
  taxPct?: unknown;
  taxAmount?: unknown;
}): EstimateDTO {
  const subtotalCost = Number(row.subtotalCost);
  const costAfterOverhead = applyOverhead(subtotalCost, 0, Number(row.overheadPct ?? 0));
  const taxAmount = Number(row.taxAmount ?? 0);
  const totalPrice = Number(row.totalPrice);
  return {
    id: row.id,
    orgId: row.orgId,
    projectId: row.projectId,
    version: row.version,
    status: normalizeEstimateStatus(row.status),
    overheadPct: Number(row.overheadPct ?? 0),
    profitPct: Number(row.profitPct ?? 0),
    targetMarginPct: row.targetMarginPct != null ? Number(row.targetMarginPct) : null,
    subtotalCost,
    totalPrice,
    taxPct: Number(row.taxPct ?? 0),
    taxAmount,
    costAfterOverhead,
    preTaxTotalPrice: round2(totalPrice - taxAmount),
  };
}

function toEstimateQueueItemDTO(row: {
  id: string;
  projectId: string;
  version: number;
  status: string;
  totalPrice: unknown;
  createdAt: Date;
  updatedAt: Date;
  project: { name: string; customer: { name: string } | null };
}): EstimateQueueItemDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    customerName: row.project.customer?.name ?? null,
    status: normalizeEstimateStatus(row.status),
    amount: Number(row.totalPrice),
    revision: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toLineItemDTO(row: {
  id: string;
  estimateId: string;
  costItemId: string | null;
  assemblyId: string | null;
  description: string;
  quantity: unknown;
  unitOfMeasure: string;
  unitCost: unknown;
  lineCost: unknown;
  sortOrder: number;
  sourceKey?: string | null;
  section?: string | null;
  costType?: string | null;
  taxable?: boolean | null;
}): EstimateLineItemDTO {
  return {
    id: row.id,
    estimateId: row.estimateId,
    costItemId: row.costItemId,
    assemblyId: row.assemblyId,
    description: row.description,
    quantity: Number(row.quantity),
    unitOfMeasure: row.unitOfMeasure,
    unitCost: Number(row.unitCost),
    lineCost: Number(row.lineCost),
    sortOrder: row.sortOrder,
    sourceKey: row.sourceKey ?? null,
    section: row.section ?? "General",
    costType: (row.costType ?? "other") as EstimateCostType,
    taxable: row.taxable ?? false,
  };
}

function inferCostType(item: { laborRateId?: string | null; materialId?: string | null; equipmentId?: string | null; subcontractorId?: string | null }): EstimateCostType {
  if (item.laborRateId) return "labor";
  if (item.materialId) return "material";
  if (item.equipmentId) return "equipment";
  if (item.subcontractorId) return "subcontractor";
  return "other";
}
