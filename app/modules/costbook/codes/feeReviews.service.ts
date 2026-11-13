import { prisma } from "../../../db/client";
import { ApiError } from "../../../backend/middleware/errorHandler";
import {
  isFeeSource,
  type CodesFeeReviewDTO,
  type CreateFeeReviewInput,
  type FeeReviewStatus,
  type ReviewFeeInput,
  type SelectFeeCostItemInput,
} from "./types";

/**
 * Price-neutral permit-fee review (issue #946, TODO 5).
 *
 * This service contains NO Estimate write of any kind — no
 * estimate.update, no estimate line-item write, no total recompute.
 * The workflow is research -> human review -> approved/rejected, and
 * even an approved fee affects estimated cost ONLY when a CostItem was
 * explicitly selected through selectCostItem, and then only through
 * the existing explicit CostItem write semantics owned by the estimator
 * — never by this service. `mayAffectEstimate` is an advisory flag on
 * the DTO; pending, rejected, and unselected fees are financial no-ops.
 */
function requireOwnerOrAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ApiError(403, "Only an owner or admin may manage fee reviews");
  }
}

/** Advisory only. True only for approved + explicitly selected CostItem. */
export function mayAffectEstimate(status: string, costItemId: string | null): boolean {
  return status === "approved" && costItemId !== null;
}

function toDTO(row: {
  id: string;
  orgId: string;
  projectId: string;
  estimateId: string | null;
  assessmentId: string | null;
  feeCents: number | null;
  feeSource: string | null;
  currency: string;
  status: string;
  costItemId: string | null;
  note: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CodesFeeReviewDTO {
  const status = row.status as FeeReviewStatus;
  if (status !== "pending" && status !== "approved" && status !== "rejected") {
    throw new ApiError(500, "Stored fee review has an unsupported status");
  }
  return {
    id: row.id,
    orgId: row.orgId,
    projectId: row.projectId,
    estimateId: row.estimateId,
    assessmentId: row.assessmentId,
    feeCents: row.feeCents,
    feeSource: isFeeSource(row.feeSource) ? row.feeSource : null,
    currency: row.currency,
    status,
    costItemId: row.costItemId,
    note: row.note,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    mayAffectEstimate: mayAffectEstimate(status, row.costItemId),
  };
}

export class CodesFeeReviewsService {
  constructor(private readonly db: typeof prisma = prisma) {}

  private async requireProject(orgId: string, projectId: string) {
    const project = await this.db.project.findFirst({ where: { id: projectId, orgId } });
    if (!project) throw new ApiError(404, "Project not found");
    return project;
  }

  async list(orgId: string, projectId: string): Promise<CodesFeeReviewDTO[]> {
    await this.requireProject(orgId, projectId);
    const rows = await this.db.codesFeeReview.findMany({
      where: { orgId, projectId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDTO);
  }

  async get(orgId: string, feeReviewId: string): Promise<CodesFeeReviewDTO> {
    const row = await this.db.codesFeeReview.findFirst({ where: { id: feeReviewId, orgId } });
    if (!row) throw new ApiError(404, "Fee review not found");
    return toDTO(row);
  }

  async create(input: CreateFeeReviewInput): Promise<CodesFeeReviewDTO> {
    requireOwnerOrAdmin(input.role);
    if (!input.orgId || !input.actorId) throw new ApiError(401, "Authenticated fee-review scope is required");
    if (input.feeCents !== undefined && input.feeCents !== null && (!Number.isInteger(input.feeCents) || input.feeCents < 0)) {
      throw new ApiError(400, "feeCents must be a non-negative integer number of cents");
    }
    if (input.feeSource !== undefined && input.feeSource !== null && !isFeeSource(input.feeSource)) {
      throw new ApiError(400, "feeSource must be 'quoted' or 'verified'");
    }
    if (input.currency !== undefined && !/^[A-Z]{3}$/.test(input.currency)) {
      throw new ApiError(400, "currency must be a 3-letter ISO code");
    }
    if (input.note !== undefined && input.note !== null && input.note.length > 2000) {
      throw new ApiError(400, "note is too long (max 2000 characters)");
    }
    await this.requireProject(input.orgId, input.projectId);
    if (input.estimateId) {
      const estimate = await this.db.estimate.findFirst({
        where: { id: input.estimateId, orgId: input.orgId, projectId: input.projectId },
      });
      if (!estimate) throw new ApiError(404, "Estimate not found for this project");
    }
    // costItemId is NEVER accepted at creation. It is set only by the
    // explicit selectCostItem step, so no fee can silently become
    // estimate-affecting at intake.
    const row = await this.db.codesFeeReview.create({
      data: {
        orgId: input.orgId,
        projectId: input.projectId,
        estimateId: input.estimateId ?? null,
        assessmentId: input.assessmentId ?? null,
        feeCents: input.feeCents ?? null,
        feeSource: input.feeSource ?? null,
        currency: input.currency ?? "USD",
        status: "pending",
        costItemId: null,
        note: input.note ?? null,
      },
    });
    return toDTO(row);
  }

  async review(input: ReviewFeeInput): Promise<CodesFeeReviewDTO> {
    requireOwnerOrAdmin(input.role);
    if (!input.orgId || !input.actorId || !Number.isFinite(input.expectedUpdatedAt.getTime())) {
      throw new ApiError(400, "Fee review identity and revision are required");
    }
    if (input.decision !== "approved" && input.decision !== "rejected") {
      throw new ApiError(400, "decision must be 'approved' or 'rejected'");
    }
    const existing = await this.db.codesFeeReview.findFirst({ where: { id: input.feeReviewId, orgId: input.orgId } });
    if (!existing) throw new ApiError(404, "Fee review not found");
    if (existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
      throw new ApiError(409, "This fee review changed. Refresh before saving again.");
    }
    if (existing.status !== "pending") {
      throw new ApiError(409, `Only a pending fee review can be reviewed (current: ${existing.status})`);
    }
    if (input.note !== undefined && input.note !== null && input.note.length > 2000) {
      throw new ApiError(400, "note is too long (max 2000 characters)");
    }
    const row = await this.db.codesFeeReview
      .update({
        where: { id: input.feeReviewId, updatedAt: input.expectedUpdatedAt },
        data: {
          status: input.decision,
          reviewedBy: input.actorId,
          reviewedAt: new Date(),
          ...(input.note !== undefined ? { note: input.note } : {}),
          updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)),
        },
      })
      .catch((error: unknown) => {
        if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
          throw new ApiError(409, "This fee review changed. Refresh before saving again.");
        }
        throw error;
      });
    return toDTO(row);
  }

  /**
   * The ONLY path that sets costItemId. The CostItem must exist in this
   * org; the review must already be approved. Selecting a CostItem does
   * NOT write to any estimate — it only records which CostItem an
   * explicit estimator step may later use.
   */
  async selectCostItem(input: SelectFeeCostItemInput): Promise<CodesFeeReviewDTO> {
    requireOwnerOrAdmin(input.role);
    if (!input.orgId || !input.actorId || !Number.isFinite(input.expectedUpdatedAt.getTime())) {
      throw new ApiError(400, "Fee review identity and revision are required");
    }
    const existing = await this.db.codesFeeReview.findFirst({ where: { id: input.feeReviewId, orgId: input.orgId } });
    if (!existing) throw new ApiError(404, "Fee review not found");
    if (existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
      throw new ApiError(409, "This fee review changed. Refresh before saving again.");
    }
    if (existing.status !== "approved") {
      throw new ApiError(409, `A CostItem can be selected only for an approved fee (current: ${existing.status})`);
    }
    const costItem = await this.db.costItem.findFirst({ where: { id: input.costItemId, orgId: input.orgId } });
    if (!costItem) throw new ApiError(404, "CostItem not found in this organization");
    const row = await this.db.codesFeeReview
      .update({
        where: { id: input.feeReviewId, updatedAt: input.expectedUpdatedAt },
        data: {
          costItemId: input.costItemId,
          updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)),
        },
      })
      .catch((error: unknown) => {
        if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
          throw new ApiError(409, "This fee review changed. Refresh before saving again.");
        }
        throw error;
      });
    return toDTO(row);
  }

  async remove(orgId: string, role: string, feeReviewId: string): Promise<void> {
    requireOwnerOrAdmin(role);
    const existing = await this.db.codesFeeReview.findFirst({ where: { id: feeReviewId, orgId } });
    if (!existing) throw new ApiError(404, "Fee review not found");
    await this.db.codesFeeReview.delete({ where: { id: feeReviewId } });
  }
}
