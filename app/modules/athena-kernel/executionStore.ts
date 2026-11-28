import { Prisma } from "@prisma/client";
import { prisma, basePrisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import { AthenaKernelState, AthenaTelemetryCost } from "./types";
import { createAthenaGenerationRecord, CreateAthenaGenerationInput } from "../athena-generation/store";

// Application-service-owned persistence seam for the A1 kernel execution
// record (docs/athena/roadmap/A1-ai-kernel-implementation-plan.md
// "Execution store"). Model/planner/provider/tool code must never import
// this directly - only the kernel service does, so Athena never queries the
// database except through this narrow seam (Bible Binding Decision 9).
// Each function runs inside runInDatabaseTransaction: when a request-scoped
// RLS transaction is already active it is reused; otherwise — the Athena
// chat route, which runs outside the request transaction so the Gemini wait
// holds no pool connection (Fluid PR-4) — it opens its own short RLS session
// from the validated session actor the chat controller established. Writes
// that belong together (execution + initial transition, transition + state
// update) share one short transaction, so they still commit or fail as a
// unit. They no longer share a transaction with the provider wait or with
// each other: a chat that fails mid-persist can leave an execution record
// without a generation, or vice versa (see the PR-4 partial-failure
// enumeration); the kernel already tolerates partial persists.
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
  await runInDatabaseTransaction(basePrisma, async () => {
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
  await runInDatabaseTransaction(basePrisma, async () => {
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
  });
}

export interface FinalizeExecutionInput {
  executionId: string;
  safeSummary: string;
  safeErrorCode?: string;
}

export async function finalizeExecutionRecord(input: FinalizeExecutionInput): Promise<void> {
  await runInDatabaseTransaction(basePrisma, async () => {
    await prisma.athenaExecution.update({
      where: { id: input.executionId },
      data: {
        safeSummary: input.safeSummary,
        safeErrorCode: input.safeErrorCode ?? null,
        completedAt: new Date(),
      },
    });
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
  await runInDatabaseTransaction(basePrisma, async () => {
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
  });
}

export async function getExecutionRecord(executionId: string) {
  return runInDatabaseTransaction(basePrisma, async () => prisma.athenaExecution.findFirst({ where: { id: executionId } }));
}

export async function persistGenerationRecord(input: CreateAthenaGenerationInput): Promise<void> {
  await runInDatabaseTransaction(basePrisma, async () => {
    await createAthenaGenerationRecord(input);
  });
}
