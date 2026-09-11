import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { createPrismaAthenaIdempotencyStore } from "../../db/athenaActionIdempotencyStore";
import { getRolePermissions, normalizeRole } from "../../domain";
import { athenaActionIdempotencyConflictError } from "../../modules/athena-action-engine/errors";
import { AthenaIdempotencyConflictError, type AthenaIdempotencyStore } from "../../modules/athena-action-engine/idempotency";
import { createPrismaAthenaAuditStore, createTerminalTrackingAthenaAuditStore } from "../../modules/athena-audit/store";
import { buildAthenaSecurityAuditEvent } from "../../modules/athena-audit/securityEvents";
import { ATHENA_MAX_MESSAGE_LENGTH, AthenaKernelService } from "../../modules/athena-kernel/service";
import { isAthenaKernelEnabled } from "../../modules/athena-kernel/flags";
import { createProductionAthenaToolRegistry } from "../../modules/athena-tools/registry";
import { requireAuthContext, requireOrgId } from "../requestContext";
import { ApiError } from "../middleware/errorHandler";
import { AthenaKernelResult } from "../../modules/athena-kernel/types";

const service = new AthenaKernelService();
const toolRegistry = createProductionAthenaToolRegistry();
const auditStore = createPrismaAthenaAuditStore();
const idempotencyStore = createPrismaAthenaIdempotencyStore();

function createRequestIdempotencyStore(store: AthenaIdempotencyStore, correlationId: string): { store: AthenaIdempotencyStore; releaseIncomplete(): Promise<void> } {
  const claimed = new Set<string>();
  const requestStore: AthenaIdempotencyStore = {
    async reserve<TData = unknown>(scopeKey: string, inputHash: string) {
      try {
        const reservation = await store.reserve<TData>(scopeKey, inputHash);
        if (reservation.outcome === "new") claimed.add(scopeKey);
        return reservation;
      } catch (error) {
        if (error instanceof AthenaIdempotencyConflictError) throw athenaActionIdempotencyConflictError(correlationId);
        throw error;
      }
    },
    async complete(scopeKey, outcome) { await store.complete(scopeKey, outcome); claimed.delete(scopeKey); },
    async release(scopeKey) { await store.release(scopeKey); claimed.delete(scopeKey); },
  };
  return {
    store: requestStore,
    async releaseIncomplete() { for (const scopeKey of [...claimed]) await requestStore.release(scopeKey); },
  };
}

function resolveStatusCode(result: AthenaKernelResult): number {
  if (result.success) return 200;
  if (result.state === "denied") return 403;
  if (result.state === "expired") return 504;
  if (result.state === "cancelled") return 499;
  switch (result.error?.category) {
    case "validation": return 400;
    case "authorization": return 403;
    case "conflict": return 409;
    case "timeout": return 504;
    case "provider":
    case "service": return 502;
    default: return 500;
  }
}

const selectedScopeSchema = z.object({
  customerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  estimateId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  page: z.string().trim().max(200).optional(),
}).optional();

const voiceConfirmationSchema = z.object({
  toolId: z.string().trim().min(1).max(200),
  toolVersion: z.string().trim().min(1).max(100),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  confirmed: z.literal(true),
}).strict();

const interactionSchema = z.object({
  channel: z.enum(["text", "mobile", "voice"]),
  platform: z.enum(["ios", "android", "web"]).optional(),
  viewportClass: z.enum(["compact", "regular"]).optional(),
  connectivity: z.enum(["online", "degraded", "offline"]).optional(),
  voiceConfirmation: voiceConfirmationSchema.optional(),
}).strict().optional();

export const athenaChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(ATHENA_MAX_MESSAGE_LENGTH),
  conversationId: z.string().uuid().optional(),
  selectedScope: selectedScopeSchema,
  interaction: interactionSchema,
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

export const athenaController = {
  async chat(req: Request, res: Response): Promise<void> {
    if (!isAthenaKernelEnabled()) throw new ApiError(404, `Route not found: ${req.method} ${req.path}`);

    const auth = requireAuthContext(req);
    const orgId = requireOrgId(req);
    const body = athenaChatRequestSchema.parse(req.body);
    const canonicalRole = normalizeRole(auth.role);
    const requestId = typeof res.locals.requestId === "string" ? res.locals.requestId : randomUUID();
    const controller = new AbortController();
    const onResponseClose = () => { if (!res.writableEnded) controller.abort(); };
    res.once("close", onResponseClose);

    try {
      const requestAuditStore = createTerminalTrackingAthenaAuditStore(auditStore);
      try {
        await requestAuditStore.record(buildAthenaSecurityAuditEvent({
          eventType: "authentication_succeeded",
          organization: orgId,
          actor: { userId: auth.userId, role: canonicalRole },
          outcome: "allowed",
          metadata: { eventSource: "athena_controller", channel: body.interaction?.channel ?? "text" },
          requestId,
        }));
      } catch {
        // Best effort; authorization remains server-side and authoritative.
      }

      const requestIdempotency = createRequestIdempotencyStore(idempotencyStore, requestId);
      const result = await service.handleRequest({
        request: {
          message: body.message,
          conversationId: body.conversationId,
          selectedScope: body.selectedScope,
          requestSource: "http",
          interaction: body.interaction,
        },
        actor: {
          userId: auth.userId,
          orgId,
          role: canonicalRole,
          permissions: [...(auth.permissions ?? getRolePermissions(auth.role))],
        },
        requestId,
        clientSignal: controller.signal,
        toolRegistry,
        idempotencyKey: body.idempotencyKey,
        idempotencyStore: requestIdempotency.store,
        auditStore: requestAuditStore,
      });

      await requestIdempotency.releaseIncomplete();
      if (!requestAuditStore.hasTerminalEvent(result.executionId)) {
        await requestAuditStore.record({
          id: randomUUID(),
          timestamp: new Date(),
          actor: { userId: auth.userId, role: canonicalRole },
          organization: orgId,
          eventType: result.success ? "execution_completed" : "failure",
          metadata: {
            finalState: result.state,
            reasonCode: result.error?.code ?? (result.success ? "request_completed" : "athena_request_failed"),
            channel: body.interaction?.channel ?? "text",
          },
          requestId,
          traceId: result.traceId,
          executionId: result.executionId,
        });
      }
      res.status(resolveStatusCode(result)).json(result);
    } finally {
      res.removeListener("close", onResponseClose);
    }
  },
};
