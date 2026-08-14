import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import type { AthenaAuditEventType } from "../athena-audit/types";
import { createPrismaAthenaApprovalStore, toApprovalRecord } from "./store";
import type { AthenaApprovalRecord, AthenaApprovalStatus } from "./types";

export interface AthenaApprovalSubmissionInput {
  organizationId: string;
  userId: string;
  actionId: string;
  toolId: string;
  toolVersion: string;
  riskLevel: "medium" | "high";
  expiration: Date;
  idempotencyKey: string;
  inputHash: string;
  planId: string;
  stepId: string;
  metadata?: Record<string, unknown>;
}

export interface AthenaApprovalListFilters {
  organizationId: string;
  status?: AthenaApprovalStatus;
  userId?: string;
  limit?: number;
}

export interface AthenaApprovalAuditRecord {
  id: string;
  timestamp: string;
  eventType: AthenaAuditEventType;
  actorUserId: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown>;
}

export interface AthenaApprovalDetail {
  approval: AthenaApprovalRecord;
  auditEvents: AthenaApprovalAuditRecord[];
}

export class AthenaApprovalBindingConflictError extends Error {
  readonly code = "approval_binding_conflict";
}

export class AthenaApprovalReviewError extends Error {
  constructor(readonly code: "approval_not_found" | "approval_not_pending" | "self_approval_forbidden") {
    super(code);
  }
}

const store = createPrismaAthenaApprovalStore();
const DEFAULT_LIMIT = 50;

function toAuditRecord(row: {
  id: string;
  createdAt: Date;
  eventType: string;
  actorUserId: string | null;
  actorRole: string | null;
  metadataJson: Prisma.JsonValue;
}): AthenaApprovalAuditRecord {
  return {
    id: row.id,
    timestamp: row.createdAt.toISOString(),
    eventType: row.eventType as AthenaAuditEventType,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    metadata: (row.metadataJson ?? {}) as Record<string, unknown>,
  };
}

function hasMatchingBinding(record: AthenaApprovalRecord, input: AthenaApprovalSubmissionInput): boolean {
  return (
    record.organizationId === input.organizationId &&
    record.actionId === input.actionId &&
    record.idempotencyKey === input.idempotencyKey &&
    record.inputHash === input.inputHash &&
    record.planId === input.planId &&
    record.stepId === input.stepId &&
    record.toolId === input.toolId &&
    record.toolVersion === input.toolVersion &&
    record.riskLevel === input.riskLevel &&
    record.userId === input.userId
  );
}

export class AthenaApprovalService {
  async submit(input: AthenaApprovalSubmissionInput): Promise<AthenaApprovalRecord> {
    const row = await prisma.athenaApproval.upsert({
      where: {
        orgId_actionId: {
          orgId: input.organizationId,
          actionId: input.actionId,
        },
      },
      update: {},
      create: {
        id: randomUUID(),
        userId: input.userId,
        orgId: input.organizationId,
        actionId: input.actionId,
        toolId: input.toolId,
        toolVersion: input.toolVersion,
        riskLevel: input.riskLevel,
        approvedAt: null,
        approvedBy: null,
        expiresAt: input.expiration,
        status: "pending",
        idempotencyKey: input.idempotencyKey,
        inputHash: input.inputHash,
        planId: input.planId,
        stepId: input.stepId,
        metadataJson: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    const approval = toApprovalRecord(row);
    if (!hasMatchingBinding(approval, input)) {
      throw new AthenaApprovalBindingConflictError("An approval already exists for this action with a different binding");
    }
    return approval;
  }

  async list(filters: AthenaApprovalListFilters): Promise<AthenaApprovalRecord[]> {
    const rows = await prisma.athenaApproval.findMany({
      where: {
        orgId: filters.organizationId,
        status: filters.status,
        userId: filters.userId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: filters.limit ?? DEFAULT_LIMIT,
    });
    return rows.map(toApprovalRecord);
  }

  async getDetail(organizationId: string, approvalId: string): Promise<AthenaApprovalDetail | null> {
    const approval = await store.getById(approvalId);
    if (!approval || approval.organizationId !== organizationId) {
      return null;
    }

    const auditEvents = await prisma.athenaAuditEvent.findMany({
      where: {
        orgId: organizationId,
        OR: [{ approvalId }, { actionId: approval.actionId }],
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    return {
      approval,
      auditEvents: auditEvents.map(toAuditRecord),
    };
  }

  private async assertReviewAllowed(organizationId: string, approvalId: string, approvedBy: string, reviewedAt: Date): Promise<void> {
    const approval = await store.getById(approvalId);
    if (!approval || approval.organizationId !== organizationId) {
      throw new AthenaApprovalReviewError("approval_not_found");
    }
    if (approval.userId === approvedBy) {
      throw new AthenaApprovalReviewError("self_approval_forbidden");
    }
    if (approval.status !== "pending" || approval.expiration.getTime() <= reviewedAt.getTime()) {
      throw new AthenaApprovalReviewError("approval_not_pending");
    }
  }

  private async review(organizationId: string, approvalId: string, approvedBy: string, decision: "grant" | "deny"): Promise<AthenaApprovalRecord> {
    const reviewedAt = new Date();
    await this.assertReviewAllowed(organizationId, approvalId, approvedBy, reviewedAt);
    const reviewed = await store.reviewPending(organizationId, approvalId, decision, approvedBy, reviewedAt);
    if (!reviewed) {
      // The approval was changed or expired after the pre-check. The conditional
      // store transition is the authority, so a stale reviewer never overwrites
      // a concurrent grant/deny/revoke/expiry or grants an expired request.
      throw new AthenaApprovalReviewError("approval_not_pending");
    }
    return reviewed;
  }

  async grant(organizationId: string, approvalId: string, approvedBy: string): Promise<AthenaApprovalRecord> {
    return this.review(organizationId, approvalId, approvedBy, "grant");
  }

  async deny(organizationId: string, approvalId: string, approvedBy: string): Promise<AthenaApprovalRecord> {
    return this.review(organizationId, approvalId, approvedBy, "deny");
  }
}
