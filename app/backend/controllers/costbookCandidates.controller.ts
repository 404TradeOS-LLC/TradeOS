import { Request, Response } from "express";
import { z } from "zod";
import { CostbookCandidateService } from "../../modules/costbook/candidateCostItemService";
import { costDataProvenanceStatus } from "../../modules/costbook";
import { costbookCandidateConfidence, costbookCandidateReviewStatus } from "../../modules/costbook/candidateCostItem";
import { requirePermissions } from "../requestContext";
import { catalogQuerySchema, parseCatalogQuery } from "../../modules/shared/catalog-query";

const service = new CostbookCandidateService();
const idParamSchema = z.object({ id: z.string().uuid() });

const costRangeSchema = z.number().finite().nonnegative();

// Deliberately excludes reviewStatus/reviewedBy/reviewedAt/promotedAt and
// friends: a candidate always starts in the "candidate" state and only the
// review()/promote() endpoints below may ever advance it. Accepting any of
// those fields here would let a caller submit a pre-approved candidate.
const createCandidateSchema = z.object({
  trade: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(120),
  itemName: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000).optional(),
  unitOfMeasure: z.string().trim().min(1).max(40),
  materialCostLow: costRangeSchema.optional(),
  materialCostTypical: costRangeSchema,
  materialCostHigh: costRangeSchema.optional(),
  laborHours: costRangeSchema.optional(),
  laborRateAssumption: costRangeSchema.optional(),
  equipmentCost: costRangeSchema.optional(),
  sourceName: z.string().trim().min(1).max(300),
  sourceUrl: z.string().trim().url().optional(),
  sourceIdentifier: z.string().trim().min(1).max(300).optional(),
  sourceDate: z.string().trim().min(1).max(40),
  retrievedAt: z.string().trim().min(1).max(40),
  regionalBasis: z.string().trim().min(1).max(200),
  confidence: z.enum(costbookCandidateConfidence),
  researchNotes: z.string().trim().min(1).max(4000).optional(),
  provenanceStatus: z.enum(costDataProvenanceStatus).optional(),
}).strict();

const listQuerySchema = catalogQuerySchema.extend({
  reviewStatus: z.enum(costbookCandidateReviewStatus).optional(),
}).strict();

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().trim().min(1).max(4000).optional(),
}).strict();

export const costbookCandidatesController = {
  async create(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    const input = createCandidateSchema.parse(req.body);
    res.status(201).json(await service.create(auth, input));
  },

  async list(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const parsed = listQuerySchema.parse(req.query);
    const query = parseCatalogQuery(
      { limit: parsed.limit, cursor: parsed.cursor, q: parsed.q, sort: parsed.sort, order: parsed.order ?? "desc" },
      { defaultSort: "createdAt", allowedSorts: ["createdAt", "updatedAt", "reviewStatus"], filters: { reviewStatus: parsed.reviewStatus } }
    );
    res.json(await service.listPage(auth, query, { reviewStatus: parsed.reviewStatus }));
  },

  async getById(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.getById(auth, id));
  },

  async review(req: Request, res: Response) {
    // Reviewing is an owner/admin-only action even though estimator-level
    // roles may hold costbook.write to submit candidates - mirrors
    // supplier-integration's approve/reject requiring costbook.manage.
    // requireAuthContext() alone is not enough: reviewedByUserId is always
    // the authenticated caller's real user id (auth.userId), never a
    // free-text field, so "AI"/"system"/"Claude" can never appear there.
    const auth = requirePermissions(req, ["costbook.manage"]);
    const { id } = idParamSchema.parse(req.params);
    const input = reviewSchema.parse(req.body);
    res.json(await service.review(auth, id, input));
  },

  async promote(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.promote(auth, id));
  },
};
