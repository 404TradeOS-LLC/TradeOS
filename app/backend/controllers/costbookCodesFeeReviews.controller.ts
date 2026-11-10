import { Request, Response } from "express";
import { z } from "zod";
import { requireOrgId, requirePermissions } from "../requestContext";
import { ApiError } from "../middleware/errorHandler";
import { CodesFeeReviewsService } from "../../modules/costbook/codes/feeReviews.service";

const service = new CodesFeeReviewsService();

const uuid = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid UUID");

const createSchema = z.object({
  projectId: uuid,
  estimateId: uuid.nullable().optional(),
  assessmentId: uuid.nullable().optional(),
  feeCents: z.number().int().min(0).max(2147483647).nullable().optional(),
  feeSource: z.enum(["quoted", "verified"]).nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  note: z.string().max(2000).nullable().optional(),
}).strict();

const reviewSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(2000).nullable().optional(),
}).strict();

const selectCostItemSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  costItemId: uuid,
}).strict();

export const codesFeeReviewsController = {
  async list(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const projectId = req.query.projectId;
    if (typeof projectId !== "string" || !projectId) throw new ApiError(400, "projectId query parameter is required");
    res.json(await service.list(requireOrgId(req), projectId));
  },
  async getById(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    res.json(await service.get(requireOrgId(req), req.params.feeReviewId));
  },
  async create(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const body = createSchema.parse(req.body);
    res.status(201).json(
      await service.create({
        orgId: requireOrgId(req),
        role: auth.role,
        actorId: auth.userId,
        projectId: body.projectId,
        estimateId: body.estimateId ?? null,
        assessmentId: body.assessmentId ?? null,
        feeCents: body.feeCents ?? null,
        feeSource: body.feeSource ?? null,
        currency: body.currency,
        note: body.note ?? null,
      }),
    );
  },
  async review(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const body = reviewSchema.parse(req.body);
    res.json(
      await service.review({
        orgId: requireOrgId(req),
        role: auth.role,
        actorId: auth.userId,
        feeReviewId: req.params.feeReviewId,
        expectedUpdatedAt: new Date(body.expectedUpdatedAt),
        decision: body.decision,
        note: body.note ?? null,
      }),
    );
  },
  async selectCostItem(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const body = selectCostItemSchema.parse(req.body);
    res.json(
      await service.selectCostItem({
        orgId: requireOrgId(req),
        role: auth.role,
        actorId: auth.userId,
        feeReviewId: req.params.feeReviewId,
        expectedUpdatedAt: new Date(body.expectedUpdatedAt),
        costItemId: body.costItemId,
      }),
    );
  },
  async remove(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    await service.remove(requireOrgId(req), auth.role, req.params.feeReviewId);
    res.status(204).send();
  },
};
