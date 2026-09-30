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
  sourceDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).max(40),
  retrievedAt: z.string().trim().datetime({ offset: true }),
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

// The Knowledge Engine corpus is keyed by its own record ids, which are uuids
// in the canonical export. Validated here so a malformed id fails at the edge.
const ingestFromKnowledgeSchema = z.object({
  knowledgeItemId: z.string().uuid(),
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

  async summary(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    res.json(await service.summary(auth));
  },

  async corpusReport(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    res.json(service.knowledgeCorpusReport(auth));
  },

  async match(req: Request, res: Response) {
    // Read-only duplicate analysis. costbook.read is sufficient because it
    // reveals nothing the caller cannot already read from their own catalog,
    // and it mutates nothing.
    const auth = requirePermissions(req, ["costbook.read"]);
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.matchPreview(auth, id));
  },

  async ingestFromKnowledge(req: Request, res: Response) {
    // Creating a candidate is a costbook.write action, exactly like the
    // hand-submitted path above. Ingestion can never approve or promote: the
    // resulting row always starts in the "candidate" state.
    const auth = requirePermissions(req, ["costbook.write"]);
    const { knowledgeItemId } = ingestFromKnowledgeSchema.parse(req.body);
    res.status(201).json(await service.createFromKnowledgeItem(auth, knowledgeItemId));
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
