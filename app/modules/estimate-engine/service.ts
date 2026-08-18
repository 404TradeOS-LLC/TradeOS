import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import { ApiError } from "../../backend/middleware/errorHandler";
import { CostDatabaseService } from "../cost-database/service";
import { AssembliesDatabaseService } from "../assemblies-database/service";
import { getDefaultAthenaEventService } from "../athena-events/service";
import { applyOverhead, sellPrice, round2 } from "./formulas";
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
          })),
        },
      },
    });

    return this.getById(row.id, orgId);
  }

  async addLineItem(input: AddLineItemInput): Promise<EstimateLineItemDTO> {
    if (!input.orgId) throw new ApiError(400, "Organization context is required for estimate catalog mutations");
    await this.assertDraft(input.estimateId, input.orgId);
    if (!input.costItemId && !input.assemblyId) {
      throw new ApiError(400, "Either costItemId or assemblyId is required");
    }
    if (input.costItemId && input.assemblyId) {
      throw new ApiError(400, "Provide exactly one of costItemId or assemblyId, not both");
    }

    let unitOfMeasure: string;
    let unitCost: number;
    let description = input.description ?? "";

    if (input.costItemId) {
      const item = await prisma.costItem.findFirst({ where: { id: input.costItemId, orgId: input.orgId } });
      if (!item) throw new ApiError(404, `CostItem ${input.costItemId} not found`);
      const breakdown = await this.costDatabase.getUnitCost(input.costItemId, input.quantity, undefined, input.orgId);
      unitOfMeasure = item.unitOfMeasure;
      unitCost = breakdown.totalUnitCost;
      description = description || item.name;
    } else {
      const assembly = await prisma.assembly.findFirst({ where: { id: input.assemblyId, orgId: input.orgId } });
      if (!assembly) throw new ApiError(404, `Assembly ${input.assemblyId} not found`);
      const result = await this.assembliesDatabase.getAssemblyUnitCost(input.assemblyId as string, undefined, new Set(), input.orgId);
      unitOfMeasure = assembly.unitOfMeasure;
      unitCost = result.unitCost;
      description = description || assembly.name;
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

  async removeLineItem(lineItemId: string, orgId?: string): Promise<{ estimateId: string }> {
    const lineItem = await prisma.estimateLineItem.findUnique({ where: { id: lineItemId }, include: { estimate: true } });
    if (!lineItem) throw new ApiError(404, `EstimateLineItem ${lineItemId} not found`);
    if (orgId && lineItem.estimate.orgId !== orgId) throw new ApiError(404, `EstimateLineItem ${lineItemId} not found`);
    await this.assertDraft(lineItem.estimateId, orgId);
    await prisma.estimateLineItem.delete({ where: { id: lineItemId } });
    await this.recalculate(lineItem.estimateId, orgId);
    return { estimateId: lineItem.estimateId };
  }

  async setPricingMode(input: SetPricingModeInput): Promise<EstimateDTO> {
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

    const totalPrice =
      estimate.targetMarginPct != null
        ? sellPrice({ totalCost, mode: "targetMargin", targetMarginPct: Number(estimate.targetMarginPct) })
        : sellPrice({ totalCost, mode: "markup", markupPct: Number(estimate.profitPct) });

    const row = await prisma.estimate.update({
      where: { id: estimateId },
      data: { subtotalCost: round2(jobCost), totalPrice },
    });
    return toEstimateDTO(row);
  }

  async finalize(estimateId: string, orgId?: string): Promise<EstimateDTO & { athenaEvent?: EstimateEventRef }> {
    await this.recalculate(estimateId, orgId);
    const estimate = await prisma.estimate.findFirst({ where: { id: estimateId, orgId } });
    if (!estimate) throw new ApiError(404, `Estimate ${estimateId} not found`);
    const currentStatus = normalizeEstimateStatus(estimate.status);
    if (!canTransitionEstimateStatus(currentStatus, "ready")) {
      throw new ApiError(409, `Estimate ${estimateId} cannot transition from ${currentStatus} to ready`);
    }
    const row = await prisma.estimate.update({ where: { id: estimateId }, data: { status: "ready" } });
    const dto = toEstimateDTO(row);
    const athenaEvent = await this.publishEstimateEvent(orgId, "EstimateCompleted", row.id, `estimate:${row.id}:completed:v1`, { projectId: row.projectId, totalPrice: dto.totalPrice });
    return { ...dto, athenaEvent };
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
      const totalCost = applyOverhead(estimate.subtotalCost, 0, estimate.overheadPct);
      return estimate.totalPrice > 0 ? round2(((estimate.totalPrice - totalCost) / estimate.totalPrice) * 100) : 0;
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
}): EstimateDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    projectId: row.projectId,
    version: row.version,
    status: normalizeEstimateStatus(row.status),
    overheadPct: Number(row.overheadPct),
    profitPct: Number(row.profitPct),
    targetMarginPct: row.targetMarginPct != null ? Number(row.targetMarginPct) : null,
    subtotalCost: Number(row.subtotalCost),
    totalPrice: Number(row.totalPrice),
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
  };
}
