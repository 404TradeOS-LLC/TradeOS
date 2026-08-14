import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import {
  AthenaApprovalCreateInput,
  AthenaApprovalRecord,
  AthenaApprovalStore,
  AthenaApprovalVerificationInput,
  AthenaApprovalVerificationResult,
} from "./types";

export interface AthenaApprovalStoreOptions {
  now?: () => Date;
}

export type AthenaInMemoryApprovalStore = Omit<AthenaApprovalStore, "grant"> & {
  grant(approvalOrId: string | AthenaApprovalRecord, approvedBy?: string, approvedAt?: Date): Promise<AthenaApprovalRecord>;
};

export function toApprovalRecord(row: {
  id: string;
  userId: string;
  orgId: string;
  actionId: string;
  toolId: string;
  toolVersion: string;
  riskLevel: string;
  approvedAt: Date | null;
  approvedBy: string | null;
  expiresAt: Date;
  status: string;
  idempotencyKey: string;
  inputHash: string;
  planId: string;
  stepId: string;
  metadataJson: Prisma.JsonValue;
}): AthenaApprovalRecord {
  return {
    approvalId: row.id,
    userId: row.userId,
    organizationId: row.orgId,
    actionId: row.actionId,
    toolId: row.toolId,
    toolVersion: row.toolVersion,
    riskLevel: row.riskLevel as AthenaApprovalRecord["riskLevel"],
    approvedAt: row.approvedAt ?? new Date(0),
    approvedBy: row.approvedBy ?? "system",
    expiration: row.expiresAt,
    status: row.status as AthenaApprovalRecord["status"],
    idempotencyKey: row.idempotencyKey,
    inputHash: row.inputHash,
    planId: row.planId,
    stepId: row.stepId,
    metadata: (row.metadataJson ?? {}) as Record<string, unknown>,
  };
}

function verifyRecord(record: AthenaApprovalRecord | null, input: AthenaApprovalVerificationInput, now: Date): AthenaApprovalVerificationResult {
  if (!record) return { valid: false, reasonCode: "approval_not_found" };
  if (record.organizationId !== input.orgId) return { valid: false, reasonCode: "approval_org_mismatch" };
  if (record.userId !== input.userId) return { valid: false, reasonCode: "approval_user_mismatch" };
  if (record.toolId !== input.toolId || record.toolVersion !== input.toolVersion) return { valid: false, reasonCode: "approval_tool_mismatch" };
  if (record.riskLevel !== input.riskLevel) return { valid: false, reasonCode: "approval_risk_mismatch" };
  if (record.actionId !== input.actionId || record.idempotencyKey !== input.idempotencyKey) return { valid: false, reasonCode: "approval_action_mismatch" };
  if (record.inputHash !== input.inputHash) return { valid: false, reasonCode: "approval_input_mismatch" };
  if (record.planId !== input.planId) return { valid: false, reasonCode: "approval_plan_mismatch" };
  if (record.stepId !== input.stepId) return { valid: false, reasonCode: "approval_step_mismatch" };
  if (record.status === "expired" || now.getTime() >= record.expiration.getTime()) return { valid: false, reasonCode: "approval_expired" };
  if (record.approvedAt.getTime() > now.getTime()) return { valid: false, reasonCode: "approval_not_yet_valid" };
  if (record.status !== "granted") return { valid: false, reasonCode: "approval_not_granted" };
  return { valid: true };
}

function buildRecord(input: AthenaApprovalCreateInput, now: Date): AthenaApprovalRecord {
  const approvedAt = input.approvedAt ?? now;
  return {
    approvalId: input.approvalId,
    userId: input.userId,
    organizationId: input.organizationId,
    actionId: input.actionId,
    toolId: input.toolId,
    toolVersion: input.toolVersion,
    riskLevel: input.riskLevel,
    approvedAt,
    approvedBy: input.approvedBy ?? input.userId,
    expiration: input.expiration,
    status: input.status ?? "granted",
    idempotencyKey: input.idempotencyKey,
    inputHash: input.inputHash,
    planId: input.planId,
    stepId: input.stepId,
    metadata: input.metadata ?? {},
  };
}

export function createInMemoryAthenaApprovalStore(options: AthenaApprovalStoreOptions = {}): AthenaInMemoryApprovalStore {
  const now = options.now ?? (() => new Date());
  const records = new Map<string, AthenaApprovalRecord>();

  return {
    async create(input) {
      const record = buildRecord(input, now());
      records.set(record.approvalId, record);
      return record;
    },
    async getById(approvalId) {
      return records.get(approvalId) ?? null;
    },
    async grant(approvalOrId, approvedBy, approvedAt = now()) {
      if (typeof approvalOrId !== "string") {
        records.set(approvalOrId.approvalId, approvalOrId);
        return approvalOrId;
      }
      const existing = records.get(approvalOrId);
      if (!existing) throw new Error(`Athena approval not found: ${approvalOrId}`);
      const record = { ...existing, approvedBy: approvedBy ?? existing.approvedBy, approvedAt, status: "granted" as const };
      records.set(approvalOrId, record);
      return record;
    },
    async deny(approvalId, approvedBy, approvedAt = now()) {
      const existing = records.get(approvalId);
      if (!existing) throw new Error(`Athena approval not found: ${approvalId}`);
      const record = { ...existing, approvedBy, approvedAt, status: "denied" as const };
      records.set(approvalId, record);
      return record;
    },
    async reviewPending(organizationId, approvalId, decision, approvedBy, reviewedAt = now()) {
      const existing = records.get(approvalId);
      if (
        !existing ||
        existing.organizationId !== organizationId ||
        existing.status !== "pending" ||
        existing.expiration.getTime() <= reviewedAt.getTime()
      ) {
        return null;
      }
      const record = {
        ...existing,
        approvedBy,
        approvedAt: reviewedAt,
        status: decision === "grant" ? ("granted" as const) : ("denied" as const),
      };
      records.set(approvalId, record);
      return record;
    },
    async revoke(approvalId) {
      const existing = records.get(approvalId);
      if (!existing) throw new Error(`Athena approval not found: ${approvalId}`);
      const record = { ...existing, status: "revoked" as const };
      records.set(approvalId, record);
      return record;
    },
    async expire(approvalId, expiredAt = now()) {
      const existing = records.get(approvalId);
      if (!existing) throw new Error(`Athena approval not found: ${approvalId}`);
      const record = { ...existing, expiration: expiredAt, status: "expired" as const };
      records.set(approvalId, record);
      return record;
    },
    async verify(input) {
      return verifyRecord(records.get(input.approvalId) ?? null, input, now());
    },
  };
}

export function createPrismaAthenaApprovalStore(options: AthenaApprovalStoreOptions = {}): AthenaApprovalStore {
  const now = options.now ?? (() => new Date());

  return {
    async create(input) {
      const approvedAt = input.approvedAt ?? now();
      const row = await prisma.athenaApproval.create({
        data: {
          id: input.approvalId,
          userId: input.userId,
          orgId: input.organizationId,
          actionId: input.actionId,
          toolId: input.toolId,
          toolVersion: input.toolVersion,
          riskLevel: input.riskLevel,
          approvedAt,
          approvedBy: input.approvedBy ?? input.userId,
          expiresAt: input.expiration,
          status: input.status ?? "granted",
          idempotencyKey: input.idempotencyKey,
          inputHash: input.inputHash,
          planId: input.planId,
          stepId: input.stepId,
          metadataJson: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
      return toApprovalRecord(row);
    },
    async getById(approvalId) {
      const row = await prisma.athenaApproval.findFirst({ where: { id: approvalId } });
      return row ? toApprovalRecord(row) : null;
    },
    async grant(approvalId, approvedBy, approvedAt = now()) {
      const row = await prisma.athenaApproval.update({
        where: { id: approvalId },
        data: { approvedBy, approvedAt, status: "granted" },
      });
      return toApprovalRecord(row);
    },
    async deny(approvalId, approvedBy, approvedAt = now()) {
      const row = await prisma.athenaApproval.update({
        where: { id: approvalId },
        data: { approvedBy, approvedAt, status: "denied" },
      });
      return toApprovalRecord(row);
    },
    async reviewPending(organizationId, approvalId, decision, approvedBy, reviewedAt = now()) {
      const targetStatus = decision === "grant" ? "granted" : "denied";
      const update = await prisma.athenaApproval.updateMany({
        where: {
          id: approvalId,
          orgId: organizationId,
          status: "pending",
          expiresAt: { gt: reviewedAt },
        },
        data: { approvedBy, approvedAt: reviewedAt, status: targetStatus },
      });
      if (update.count !== 1) {
        return null;
      }
      const row = await prisma.athenaApproval.findFirst({
        where: { id: approvalId, orgId: organizationId, status: targetStatus },
      });
      return row ? toApprovalRecord(row) : null;
    },
    async revoke(approvalId) {
      const row = await prisma.athenaApproval.update({
        where: { id: approvalId },
        data: { status: "revoked" },
      });
      return toApprovalRecord(row);
    },
    async expire(approvalId, expiredAt = now()) {
      const row = await prisma.athenaApproval.update({
        where: { id: approvalId },
        data: { status: "expired", expiresAt: expiredAt },
      });
      return toApprovalRecord(row);
    },
    async verify(input) {
      const row = await prisma.athenaApproval.findFirst({ where: { id: input.approvalId } });
      return verifyRecord(row ? toApprovalRecord(row) : null, input, now());
    },
  };
}
