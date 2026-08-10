import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { getRolePermissions, normalizeRole } from "../../domain";
import { ATHENA_MAX_MESSAGE_LENGTH, AthenaKernelService } from "../../modules/athena-kernel/service";
import { isAthenaKernelEnabled } from "../../modules/athena-kernel/flags";
import { requireAuthContext, requireOrgId } from "../requestContext";
import { ApiError } from "../middleware/errorHandler";
import { AthenaKernelResult } from "../../modules/athena-kernel/types";

const service = new AthenaKernelService();

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

    const controller = new AbortController();
    req.once("close", () => controller.abort());

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
        permissions: [...getRolePermissions(canonicalRole)],
      },
      requestId,
      clientSignal: controller.signal,
    });

    res.status(resolveStatusCode(result)).json(result);
  },
};
