import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { getRolePermissions, normalizeRole } from "../../domain";
import { createPrismaAthenaAuditStore, createTerminalTrackingAthenaAuditStore } from "../../modules/athena-audit/store";
import { ATHENA_MAX_MESSAGE_LENGTH, AthenaKernelService } from "../../modules/athena-kernel/service";
import { isAthenaKernelEnabled } from "../../modules/athena-kernel/flags";
import { createProductionAthenaToolRegistry } from "../../modules/athena-tools/registry";
import { requireAuthContext, requireOrgId } from "../requestContext";
import { ApiError } from "../middleware/errorHandler";
import { AthenaKernelResult } from "../../modules/athena-kernel/types";

const service = new AthenaKernelService();
// A12 (docs/athena/roadmap/A12-business-tool-rollout-implementation-plan.md):
// first production tool registry - built once at module load, reused across
// requests the same way `service` above is. Passed explicitly into every
// handleRequest() call rather than relying on the kernel's empty default
// (see athena-kernel/service.ts's `toolRegistry` module comment).
const toolRegistry = createProductionAthenaToolRegistry();
const auditStore = createPrismaAthenaAuditStore();

function resolveStatusCode(result: AthenaKernelResult): number {
  if (result.success) return 200;
  if (result.state === "denied") return 403;
  if (result.state === "expired") return 504;
  if (result.state === "cancelled") return 499;
  switch (result.error?.category) {
    case "validation":
      return 400;
    case "authorization":
      return 403;
    case "timeout":
      return 504;
    case "provider":
    case "service":
      return 502;
    default:
      return 500;
  }
}

const selectedScopeSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    jobId: z.string().uuid().optional(),
    estimateId: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
    page: z.string().trim().max(200).optional(),
  })
  .optional();

const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(ATHENA_MAX_MESSAGE_LENGTH),
  conversationId: z.string().uuid().optional(),
  selectedScope: selectedScopeSchema,
});

// docs/athena/roadmap/A1-ai-kernel-implementation-plan.md "Required Backend
// Seams": controller owns HTTP + Zod validation, then hands server-derived
// actor context to the kernel service. The kernel is never reachable unless
// ATHENA_KERNEL_ENABLED is true - A1 ships dark by default.
export const athenaController = {
  async chat(req: Request, res: Response): Promise<void> {
    if (!isAthenaKernelEnabled()) {
      throw new ApiError(404, `Route not found: ${req.method} ${req.path}`);
    }

    const auth = requireAuthContext(req);
    const orgId = requireOrgId(req);
    const body = chatRequestSchema.parse(req.body);
    const canonicalRole = normalizeRole(auth.role);
    const requestId = typeof res.locals.requestId === "string" ? res.locals.requestId : randomUUID();

    // res (ServerResponse), not req (IncomingMessage), is the correct
    // client-disconnect signal here: req's "close" fires once the request
    // has been fully received - which happens before this controller even
    // runs, since body-parsing middleware precedes route handlers - and
    // says nothing about whether the client is still connected while Athena
    // is generating the response. res only closes early (before
    // writableEnded) when the client actually disconnects mid-response.
    const controller = new AbortController();
    const onResponseClose = () => {
      if (!res.writableEnded) {
        controller.abort();
      }
    };
    res.once("close", onResponseClose);

    try {
      const requestAuditStore = createTerminalTrackingAthenaAuditStore(auditStore);
      const result = await service.handleRequest({
        request: {
          message: body.message,
          conversationId: body.conversationId,
          selectedScope: body.selectedScope,
          requestSource: "http",
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
        auditStore: requestAuditStore,
      });

      // The kernel records terminal audit events for action outcomes. Some
      // non-action terminal paths (for example draft-only success, permission
      // denial, and cancellation) historically returned without one. Add the
      // request-level terminal event only when the kernel did not already
      // emit one, preserving the exactly-one terminal audit invariant without
      // duplicating successful/failed action events. Because this fallback is
      // the only durable terminal record for those paths, persistence failure
      // fails the request rather than returning without terminal audit state.
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
