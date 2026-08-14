import { Request, Response } from "express";
import { z } from "zod";
import {
  AthenaApprovalBindingConflictError,
  AthenaApprovalReviewError,
  AthenaApprovalService,
} from "../../modules/athena-approvals/service";
import { requireOrgId, requireRoles } from "../requestContext";
import { ApiError } from "../middleware/errorHandler";

const service = new AthenaApprovalService();

function requireAthenaApprovalAccess(req: Request) {
  const auth = requireRoles(req, ["owner", "admin"]);
  const orgId = requireOrgId(req);
  return { auth, orgId };
}

const listApprovalQuerySchema = z.object({
  status: z.enum(["pending", "granted", "denied", "revoked", "expired"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const approvalSubmissionSchema = z.object({
  actionId: z.string().trim().min(1).max(500),
  toolId: z.string().trim().min(1).max(200),
  toolVersion: z.string().trim().min(1).max(100),
  riskLevel: z.enum(["medium", "high"]),
  expiration: z.string().datetime(),
  idempotencyKey: z.string().trim().min(1).max(500),
  inputHash: z.string().trim().min(1).max(500),
  planId: z.string().trim().min(1).max(500),
  stepId: z.string().trim().min(1).max(500),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const approvalDecisionSchema = z.object({
  decision: z.enum(["grant", "deny"]),
});

export const athenaApprovalsController = {
  async list(req: Request, res: Response): Promise<void> {
    const { orgId } = requireAthenaApprovalAccess(req);
    const query = listApprovalQuerySchema.parse(req.query);
    res.json(await service.list({ organizationId: orgId, status: query.status, limit: query.limit }));
  },

  async get(req: Request, res: Response): Promise<void> {
    const { orgId } = requireAthenaApprovalAccess(req);
    const approvalId = z.string().uuid().parse(req.params.approvalId);
    const detail = await service.getDetail(orgId, approvalId);
    if (!detail) {
      throw new ApiError(404, "Approval not found");
    }
    res.json(detail);
  },

  async submit(req: Request, res: Response): Promise<void> {
    const { auth, orgId } = requireAthenaApprovalAccess(req);
    const body = approvalSubmissionSchema.parse(req.body);
    try {
      const approval = await service.submit({
        organizationId: orgId,
        userId: auth.userId,
        actionId: body.actionId,
        toolId: body.toolId,
        toolVersion: body.toolVersion,
        riskLevel: body.riskLevel,
        expiration: new Date(body.expiration),
        idempotencyKey: body.idempotencyKey,
        inputHash: body.inputHash,
        planId: body.planId,
        stepId: body.stepId,
        metadata: body.metadata,
      });
      res.status(201).json(approval);
    } catch (error) {
      if (error instanceof AthenaApprovalBindingConflictError) {
        throw new ApiError(409, "Approval action binding conflicts with an existing request");
      }
      throw error;
    }
  },

  async review(req: Request, res: Response): Promise<void> {
    const { auth, orgId } = requireAthenaApprovalAccess(req);
    const approvalId = z.string().uuid().parse(req.params.approvalId);
    const body = approvalDecisionSchema.parse(req.body);
    try {
      const approval =
        body.decision === "grant"
          ? await service.grant(orgId, approvalId, auth.userId)
          : await service.deny(orgId, approvalId, auth.userId);
      res.json(approval);
    } catch (error) {
      if (error instanceof AthenaApprovalReviewError) {
        if (error.code === "approval_not_found") {
          throw new ApiError(404, "Approval not found");
        }
        throw new ApiError(403, "Requesters cannot review their own Athena approval requests");
      }
      throw error;
    }
  },
};
