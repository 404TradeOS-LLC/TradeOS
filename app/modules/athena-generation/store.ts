import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../db/client";
import { redactSecrets } from "../athena-security/secretProtection";
import type { AthenaGenerationRecord, AthenaGenerationReviewOutcome, AthenaGenerationReviewRecord, AthenaGenerationStatus } from "./types";

const RAW_CONTENT_KEYS = new Set(["prompt", "rawprompt", "rawoutput", "completion", "toolarguments", "toolresults"]);

function sanitizeMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!RAW_CONTENT_KEYS.has(key.toLowerCase())) safe[key] = entry;
  }
  return redactSecrets(safe).data;
}

function toGenerationRecord(row: Awaited<ReturnType<typeof prisma.athenaGenerationRun.findFirstOrThrow>>): AthenaGenerationRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    actorUserId: row.actorUserId,
    executionId: row.executionId ?? undefined,
    requestId: row.requestId,
    traceId: row.traceId,
    provider: row.provider,
    model: row.model,
    providerVersion: row.providerVersion ?? undefined,
    status: row.status as AthenaGenerationStatus,
    failureCode: row.failureCode ?? undefined,
    inputTokens: row.inputTokens ?? undefined,
    outputTokens: row.outputTokens ?? undefined,
    estimatedUsd: row.estimatedUsd?.toNumber(),
    latencyMs: row.latencyMs,
    toolNames: Array.isArray(row.toolNamesJson) ? row.toolNamesJson.filter((name): name is string => typeof name === "string") : [],
    provenance: (row.provenanceJson as Record<string, unknown>) ?? {},
    retentionExpiresAt: row.retentionExpiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
  };
}

function toReviewRecord(row: Awaited<ReturnType<typeof prisma.athenaGenerationReview.findFirstOrThrow>>): AthenaGenerationReviewRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    generationId: row.generationId,
    reviewerUserId: row.reviewerUserId,
    outcome: row.outcome as AthenaGenerationReviewOutcome,
    provenance: (row.provenanceJson as Record<string, unknown>) ?? {},
    reviewedAt: row.reviewedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export interface CreateAthenaGenerationInput {
  id?: string;
  orgId: string;
  actorUserId: string;
  executionId?: string;
  requestId: string;
  traceId: string;
  provider: string;
  model: string;
  providerVersion?: string;
  status: AthenaGenerationStatus;
  failureCode?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedUsd?: number;
  latencyMs: number;
  toolNames?: string[];
  provenance?: Record<string, unknown>;
  retentionExpiresAt: Date;
  completedAt?: Date;
}

export async function createAthenaGenerationRecord(input: CreateAthenaGenerationInput): Promise<AthenaGenerationRecord> {
  const row = await prisma.athenaGenerationRun.create({
    data: {
      id: input.id ?? randomUUID(),
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      executionId: input.executionId,
      requestId: input.requestId,
      traceId: input.traceId,
      provider: input.provider,
      model: input.model,
      providerVersion: input.providerVersion,
      status: input.status,
      failureCode: input.failureCode,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedUsd: input.estimatedUsd === undefined ? undefined : new Prisma.Decimal(input.estimatedUsd),
      latencyMs: input.latencyMs,
      toolNamesJson: (input.toolNames ?? []) as Prisma.InputJsonValue,
      provenanceJson: sanitizeMetadata(input.provenance ?? {}) as Prisma.InputJsonValue,
      retentionExpiresAt: input.retentionExpiresAt,
      completedAt: input.completedAt,
    },
  });
  return toGenerationRecord(row);
}

export async function createAthenaGenerationReview(input: {
  orgId: string;
  generationId: string;
  reviewerUserId: string;
  outcome: AthenaGenerationReviewOutcome;
  provenance?: Record<string, unknown>;
  reviewedAt: Date;
}): Promise<AthenaGenerationReviewRecord> {
  const row = await prisma.athenaGenerationReview.create({
    data: {
      id: randomUUID(),
      orgId: input.orgId,
      generationId: input.generationId,
      reviewerUserId: input.reviewerUserId,
      outcome: input.outcome,
      provenanceJson: sanitizeMetadata(input.provenance ?? {}) as Prisma.InputJsonValue,
      reviewedAt: input.reviewedAt,
    },
  });
  return toReviewRecord(row);
}

export async function findAthenaGenerationRecord(orgId: string, id: string): Promise<AthenaGenerationRecord | null> {
  const row = await prisma.athenaGenerationRun.findFirst({ where: { orgId, id } });
  return row ? toGenerationRecord(row) : null;
}

export async function listAthenaGenerationReviews(orgId: string, generationId: string): Promise<AthenaGenerationReviewRecord[]> {
  const rows = await prisma.athenaGenerationReview.findMany({ where: { orgId, generationId }, orderBy: [{ reviewedAt: "asc" }, { id: "asc" }] });
  return rows.map(toReviewRecord);
}

export async function deleteExpiredAthenaGenerationRecords(orgId: string, now = new Date(), batchSize = 500): Promise<{ scannedBatches: number; deletedCount: number }> {
  if (!Number.isInteger(batchSize) || batchSize <= 0) throw new Error("batchSize must be a positive integer");
  let deleted = 0;
  let scannedBatches = 0;
  for (;;) {
    const rows = await prisma.athenaGenerationRun.findMany({
      where: { orgId, retentionExpiresAt: { lt: now } },
      orderBy: [{ retentionExpiresAt: "asc" }, { id: "asc" }],
      take: batchSize,
      select: { id: true },
    });
    scannedBatches += 1;
    if (rows.length === 0) return { scannedBatches, deletedCount: deleted };
    const result = await prisma.athenaGenerationRun.deleteMany({ where: { orgId, id: { in: rows.map((row) => row.id) } } });
    deleted += result.count;
    if (rows.length < batchSize) return { scannedBatches, deletedCount: deleted };
  }
}
