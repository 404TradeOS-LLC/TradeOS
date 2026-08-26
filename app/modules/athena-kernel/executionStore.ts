import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { AthenaKernelState, AthenaTelemetryCost } from "./types";
import { createAthenaGenerationRecord, CreateAthenaGenerationInput } from "../athena-generation/store";

// Application-service-owned persistence seam for the A1 kernel execution
// record (docs/athena/roadmap/A1-ai-kernel-implementation-plan.md
// "Execution store"). Model/planner/provider/tool code must never import
// this directly - only the kernel service does, so Athena never queries the
// database except through this narrow seam (Bible Binding Decision 9).
// Reuses the same request-scoped RLS session every other module uses via
// app/db/client.ts's prisma proxy; A1 has no pausable/mutating work, so the
// ambient request transaction is safe to use for this single read/write
// cycle (see HIGH-P1 in docs/athena/reviews/A1-parallel-readiness-review.md
// for why that stops being true once mutating tools exist).
export interface CreateExecutionInput {
  executionId: string;
  orgId: string;
  requestId: string;
  traceId: string;
  actorUserId: string;
  canonicalRole: string;
  requestSource: string;
}

export async function createExecutionRecord(input: CreateExecutionInput): Promise<void> {
  await prisma.athenaExecution.create({
    data: {
      id: input.executionId,
      orgId: input.orgId,
      requestId: input.requestId,
      traceId: input.traceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      canonicalRole: input.canonicalRole,
      requestSource: input.requestSource,
      state: "created",
    },
  });
  await prisma.athenaExecutionTransition.create({
    data: {
      orgId: input.orgId,
      executionId: input.executionId,
      fromState: null,
      toState: "created",
      reasonCode: "execution_created",
    },
  });
}

export interface RecordTransitionInput {
  executionId: string;
  orgId: string;
  fromState: AthenaKernelState;
  toState: AthenaKernelState;
  reasonCode: string;
  metadata?: Record<string, unknown>;
  roundTrips?: number;
}

export async function recordTransition(input: RecordTransitionInput): Promise<void> {
  await prisma.athenaExecutionTransition.create({
    data: {
      orgId: input.orgId,
      executionId: input.executionId,
      fromState: input.fromState,
      toState: input.toState,
      reasonCode: input.reasonCode,
      metadataJson: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });

  await prisma.athenaExecution.update({
    where: { id: input.executionId },
    data: {
      state: input.toState,
      ...(input.roundTrips !== undefined ? { roundTrips: input.roundTrips } : {}),
    },
  });
}

export interface FinalizeExecutionInput {
  executionId: string;
  safeSummary: string;
  safeErrorCode?: string;
}

export async function finalizeExecutionRecord(input: FinalizeExecutionInput): Promise<void> {
  await prisma.athenaExecution.update({
    where: { id: input.executionId },
    data: {
      safeSummary: input.safeSummary,
      safeErrorCode: input.safeErrorCode ?? null,
      completedAt: new Date(),
    },
  });
}

export interface PersistTelemetryInput {
  executionId: string;
  orgId: string;
  requestId: string;
  traceId: string;
  spanType: string;
  status: string;
  durationMs: number;
  redaction: string;
  cost?: AthenaTelemetryCost;
  metadata: Record<string, unknown>;
}

export async function persistTelemetryRecord(input: PersistTelemetryInput): Promise<void> {
  await prisma.athenaTelemetryRecordRow.create({
    data: {
      orgId: input.orgId,
      executionId: input.executionId,
      requestId: input.requestId,
      traceId: input.traceId,
      spanType: input.spanType,
      status: input.status,
      durationMs: input.durationMs,
      redaction: input.redaction,
      costJson: (input.cost as Prisma.InputJsonValue | undefined) ?? undefined,
      metadataJson: input.metadata as Prisma.InputJsonValue,
    },
  });
}

export async function getExecutionRecord(executionId: string) {
  return prisma.athenaExecution.findFirst({ where: { id: executionId } });
}

export async function persistGenerationRecord(input: CreateAthenaGenerationInput): Promise<void> {
  await createAthenaGenerationRecord(input);
}
