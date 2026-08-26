import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { CostDatabaseService } from "../cost-database/service";
import { canTransitionChangeOrderStatus } from "../../domain";
import { round2 } from "../estimate-engine/formulas";
import {
  AddChangeOrderLineItemInput,
  ChangeOrderDTO,
  ChangeOrderLineItemDTO,
  CreateChangeOrderInput,
  UpdateChangeOrderInput,
} from "./types";

export class ChangeOrdersService {
  private readonly costDatabase = new CostDatabaseService();

  async listByProject(projectId: string, orgId?: string): Promise<ChangeOrderDTO[]> {
    const rows = await prisma.changeOrder.findMany({ where: { projectId, project: orgId ? { orgId } : undefined }, orderBy: { coNumber: "asc" } });
    return rows.map(toDTO);
  }

  async getById(id: string, orgId?: string): Promise<ChangeOrderDTO & { lineItems: ChangeOrderLineItemDTO[] }> {
    const row = await prisma.changeOrder.findFirst({
      where: { id, project: orgId ? { orgId } : undefined },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    if (!row) throw new ApiError(404, `ChangeOrder ${id} not found`);
    return { ...toDTO(row), lineItems: row.lineItems.map(toLineItemDTO) };
  }

  async create(input: CreateChangeOrderInput): Promise<ChangeOrderDTO> {
    const project = await prisma.project.findFirst({ where: { id: input.projectId, orgId: input.orgId } });
    if (!project) throw new ApiError(404, `Project ${input.projectId} not found`);

    if (input.estimateId) {
      const estimate = await prisma.estimate.findFirst({ where: { id: input.estimateId, orgId: input.orgId, projectId: input.projectId } });
      if (!estimate) throw new ApiError(404, `Estimate ${input.estimateId} not found`);
    }

    const nextNumber = (await prisma.changeOrder.aggregate({
      where: { projectId: input.projectId },
      _max: { coNumber: true },
    }))._max.coNumber ?? 0;

    const row = await prisma.changeOrder.create({
      data: {
        projectId: input.projectId,
        estimateId: input.estimateId,
        coNumber: nextNumber + 1,
        description: input.description,
        scheduleImpactDays: input.scheduleImpactDays,
      },
    });
    return toDTO(row);
  }

  async update(changeOrderId: string, input: UpdateChangeOrderInput): Promise<ChangeOrderDTO> {
    const changeOrder = await this.assertDraft(changeOrderId, input.orgId);
    const row = await prisma.changeOrder.update({
      where: { id: changeOrder.id },
      data: {
        description: input.description ?? changeOrder.description,
        scheduleImpactDays: input.scheduleImpactDays !== undefined ? input.scheduleImpactDays : undefined,
      },
    });
    return toDTO(row);
  }

  async addLineItem(input: AddChangeOrderLineItemInput): Promise<ChangeOrderLineItemDTO> {
    const changeOrder = await prisma.changeOrder.findFirst({
      where: { id: input.changeOrderId, project: input.orgId ? { orgId: input.orgId } : undefined },
      include: { lineItems: { orderBy: { sortOrder: "asc" } }, project: true },
    });
    if (!changeOrder) throw new ApiError(404, `ChangeOrder ${input.changeOrderId} not found`);
    if (changeOrder.status !== "draft") throw new ApiError(409, `ChangeOrder ${input.changeOrderId} is not in draft status`);

    let description = input.description ?? "";
    let unitCost = input.unitCost ?? 0;
    let costItemId: string | null = input.costItemId ?? null;

    if (input.costItemId) {
      const item = await prisma.costItem.findFirst({ where: { id: input.costItemId, orgId: input.orgId } });
      if (!item) throw new ApiError(404, `CostItem ${input.costItemId} not found`);
      description = description || item.name;
      const breakdown = await this.costDatabase.getUnitCost(input.costItemId, input.quantity, undefined, input.orgId);
      unitCost = breakdown.totalUnitCost;
    } else {
      if (!description) {
        throw new ApiError(400, "description is required when costItemId is not provided");
      }
      if (input.unitCost == null) {
        throw new ApiError(400, "unitCost is required when costItemId is not provided");
      }
    }

    const lineCost = round2(unitCost * input.quantity);
    const nextSort = (changeOrder.lineItems.at(-1)?.sortOrder ?? 0) + 1;

    const row = await prisma.changeOrderLineItem.create({
      data: {
        changeOrderId: input.changeOrderId,
        costItemId,
        description,
        quantity: input.quantity,
        unitCost,
        lineCost,
        sortOrder: nextSort,
      },
    });

    await this.recalculate(input.changeOrderId, input.orgId);
    return toLineItemDTO(row);
  }

  async removeLineItem(changeOrderId: string, lineItemId: string, orgId?: string): Promise<void> {
    const changeOrder = await this.assertDraft(changeOrderId, orgId);
    const row = await prisma.changeOrderLineItem.findFirst({
      where: { id: lineItemId, changeOrderId: changeOrder.id },
    });
    if (!row) throw new ApiError(404, `ChangeOrderLineItem ${lineItemId} not found`);
    await prisma.changeOrderLineItem.delete({ where: { id: lineItemId } });
    await this.recalculate(changeOrder.id, orgId);
  }

  async delete(changeOrderId: string, orgId?: string): Promise<void> {
    const changeOrder = await this.assertDraft(changeOrderId, orgId);
    await prisma.changeOrder.delete({ where: { id: changeOrder.id } });
  }

  async approve(changeOrderId: string, orgId?: string): Promise<ChangeOrderDTO> {
    const changeOrder = await this.assertExists(changeOrderId, orgId);
    if (!canTransitionChangeOrderStatus(changeOrder.status, "approved")) {
      throw new ApiError(409, `ChangeOrder ${changeOrderId} cannot be approved from status ${changeOrder.status}`);
    }
    await this.recalculate(changeOrderId, orgId);
    const row = await prisma.changeOrder.update({
      where: { id: changeOrderId },
      data: { status: "approved", approvedAt: new Date(), rejectedAt: null },
    });
    return toDTO(row);
  }

  async reject(changeOrderId: string, orgId?: string): Promise<ChangeOrderDTO> {
    const changeOrder = await this.assertExists(changeOrderId, orgId);
    if (!canTransitionChangeOrderStatus(changeOrder.status, "rejected")) {
      throw new ApiError(409, `ChangeOrder ${changeOrderId} cannot be rejected from status ${changeOrder.status}`);
    }
    const row = await prisma.changeOrder.update({
      where: { id: changeOrderId },
      data: { status: "rejected", rejectedAt: new Date(), approvedAt: null },
    });
    return toDTO(row);
  }

  async recalculate(changeOrderId: string, orgId?: string): Promise<ChangeOrderDTO> {
    const row = await prisma.changeOrder.findFirst({ where: { id: changeOrderId, project: orgId ? { orgId } : undefined }, include: { lineItems: true } });
    if (!row) throw new ApiError(404, `ChangeOrder ${changeOrderId} not found`);
    const amount = round2(row.lineItems.reduce((sum, li) => sum + Number(li.lineCost), 0));
    const updated = await prisma.changeOrder.update({ where: { id: changeOrderId }, data: { amount } });
    return toDTO(updated);
  }

  private async assertExists(id: string, orgId?: string): Promise<{ status: "draft" | "approved" | "rejected" }> {
    const row = await prisma.changeOrder.findFirst({ where: { id, project: orgId ? { orgId } : undefined } });
    if (!row) throw new ApiError(404, `ChangeOrder ${id} not found`);
    return { status: row.status as "draft" | "approved" | "rejected" };
  }

  private async assertDraft(id: string, orgId?: string): Promise<{ id: string; description: string }> {
    const row = await prisma.changeOrder.findFirst({ where: { id, project: orgId ? { orgId } : undefined } });
    if (!row) throw new ApiError(404, `ChangeOrder ${id} not found`);
    if (row.status !== "draft") throw new ApiError(409, `ChangeOrder ${id} is not in draft status`);
    return { id: row.id, description: row.description };
  }
}

function toDTO(row: {
  id: string;
  projectId: string;
  estimateId: string | null;
  coNumber: number;
  description: string;
  status: string;
  amount: unknown;
  scheduleImpactDays?: number | null;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}): ChangeOrderDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    estimateId: row.estimateId,
    coNumber: row.coNumber,
    description: row.description,
    status: row.status,
    amount: Number(row.amount),
    scheduleImpactDays: row.scheduleImpactDays ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}

function toLineItemDTO(row: {
  id: string;
  changeOrderId: string;
  costItemId: string | null;
  description: string;
  quantity: unknown;
  unitCost: unknown;
  lineCost: unknown;
  sortOrder: number;
}): ChangeOrderLineItemDTO {
  return {
    id: row.id,
    changeOrderId: row.changeOrderId,
    costItemId: row.costItemId,
    description: row.description,
    quantity: Number(row.quantity),
    unitCost: Number(row.unitCost),
    lineCost: Number(row.lineCost),
    sortOrder: row.sortOrder,
  };
}
