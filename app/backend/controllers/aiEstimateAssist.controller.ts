import { Request, Response } from "express";
import { z } from "zod";
import { AIEstimateAssistService } from "../../modules/ai-estimate-assist/service";
import { StructuredAIEstimatorService } from "../../modules/ai-estimate-assist/structuredEstimator";
import { requireAuthContext, requireOrgId, requirePermissions, requireRoles } from "../requestContext";

const service = new AIEstimateAssistService();
const structuredEstimator = new StructuredAIEstimatorService();

export const aiEstimateAssistController = {
  async generate(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    const schema = z.object({
      scopeOfWork: z.string().trim().optional().default(""),
    });
    const body = schema.parse(req.body);
    res.json(
      await service.generateSuggestions({
        estimateId: req.params.id,
        orgId: requireOrgId(req),
        scopeOfWork: body.scopeOfWork,
      })
    );
  },

  async apply(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const schema = z.object({
      suggestions: z.array(
        z.object({
          id: z.string().min(1),
          kind: z.enum(["assembly", "costItem"]),
          title: z.string().min(1),
          quantity: z.coerce.number().positive(),
          status: z.enum(["pending", "accepted", "rejected"]),
          description: z.string().optional(),
          targetId: z.string().uuid().optional(),
          targetKind: z.enum(["assembly", "costItem"]).optional(),
        })
      ),
    });

    const body = schema.parse(req.body);
    res.json(
      await service.applySuggestions({
        estimateId: req.params.id,
        orgId: requireOrgId(req),
        suggestions: body.suggestions,
      })
    );
  },

  async draftStructuredEstimate(req: Request, res: Response) {
    const auth = requirePermissions(req, ["billing.write"]);
    const schema = z.object({
      scopeOfWork: z.string().trim().max(10_000).optional().default(""),
      limit: z.coerce.number().int().min(1).max(10).optional(),
    }).strict();

    const body = schema.parse(req.body);
    const estimateId = z.string().uuid().parse(req.params.id);
    res.json(
      await structuredEstimator.generateDraft({
        estimateId,
        orgId: requireOrgId(req),
        actorUserId: auth.userId,
        scopeOfWork: body.scopeOfWork,
        limit: body.limit,
      })
    );
  },

  async applyStructuredEstimate(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    requirePermissions(req, ["billing.write"]);
    const schema = z.object({
      generationId: z.string().uuid().optional(),
      lineItems: z.array(
        z.object({
          draftLineItemId: z.string().min(1).max(200),
          status: z.enum(["pending", "accepted", "rejected"]),
          reviewToken: z.string().min(1).max(2_000).optional(),
          targetId: z.string().uuid().optional(),
          targetKind: z.enum(["assembly", "costItem"]).optional(),
          description: z.string().trim().max(500).optional(),
          quantity: z.coerce.number().finite().positive().max(1_000_000),
        }).strict()
      ).max(50),
    }).strict();

    const body = schema.parse(req.body);
    if (body.generationId) {
      requireRoles(req, ["owner", "admin"]);
    }
    const estimateId = z.string().uuid().parse(req.params.id);
    res.json(
      await structuredEstimator.applyReviewedDraft({
        estimateId,
        orgId: requireOrgId(req),
        actorUserId: auth.userId,
        generationId: body.generationId,
        lineItems: body.lineItems,
      })
    );
  },
};
