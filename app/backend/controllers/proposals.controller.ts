import { Request, Response } from "express";
import { z } from "zod";
import { TransactionalProposalsService } from "../../modules/athena-events/transactionalPublishers";
import { requireAuthContext, requireOrgId, requirePermissions } from "../requestContext";
import { commaSeparatedEnum, strictOptionalBoolean } from "../queryParams";
import { proposalStatuses } from "../../domain";

const service = new TransactionalProposalsService();

const listQueueQuerySchema = z.object({
  status: commaSeparatedEnum(z.enum(proposalStatuses)),
  sent: strictOptionalBoolean,
  viewed: strictOptionalBoolean,
  unsigned: strictOptionalBoolean,
  staleBefore: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional(),
});

const createSchema = z.object({
  estimateId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  companyName: z.string().optional(),
  showLineItemDetail: z.boolean().optional(),
  scopeOfWork: z.string().optional(),
  assumptions: z.string().optional(),
  exclusions: z.string().optional(),
  timeline: z.string().optional(),
  priceLow: z.number().nullable().optional(),
  priceHigh: z.number().nullable().optional(),
  finalPrice: z.number().nullable().optional(),
  paymentScheduleJson: z.unknown().optional(),
  termsAndConditions: z.string().optional(),
}).refine((value) => value.estimateId || value.projectId, {
  message: "Either estimateId or projectId is required",
  path: ["estimateId"],
});

const updateSchema = z.object({
  companyName: z.string().optional(),
  showLineItemDetail: z.boolean().optional(),
  scopeOfWork: z.string().optional(),
  assumptions: z.string().optional(),
  exclusions: z.string().optional(),
  timeline: z.string().optional(),
  priceLow: z.number().nullable().optional(),
  priceHigh: z.number().nullable().optional(),
  finalPrice: z.number().nullable().optional(),
  paymentScheduleJson: z.unknown().optional(),
  termsAndConditions: z.string().optional(),
});

export const proposalsController = {
  async listByProject(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    res.json(await service.listByProject(req.params.projectId, requireOrgId(req)));
  },
  async listOrganizationQueue(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    const query = listQueueQuerySchema.parse(req.query);
    res.json(
      await service.listOrganizationQueue({
        orgId: requireOrgId(req),
        statuses: query.status,
        sent: query.sent,
        viewed: query.viewed,
        unsigned: query.unsigned,
        staleBefore: query.staleBefore,
        updatedAfter: query.updatedAfter,
        updatedBefore: query.updatedBefore,
        limit: query.limit,
        cursor: query.cursor,
      })
    );
  },
  async getById(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    res.json(await service.getById(req.params.id, requireOrgId(req)));
  },
  async previewProjectDraft(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    res.json(await service.previewProjectDraft(req.params.projectId, requireOrgId(req), req.query.companyName?.toString()));
  },
  async create(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    res.status(201).json(await service.create({ ...createSchema.parse(req.body), orgId: requireOrgId(req) }));
  },
  async update(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    res.json(await service.update(req.params.id, updateSchema.parse(req.body), requireOrgId(req)));
  },
  async getPdf(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    const doc = await service.getPdf(req.params.id, requireOrgId(req));
    res.setHeader("Content-Type", doc.contentType);
    const disposition = req.query.disposition === "inline" ? "inline" : "attachment";
    res.setHeader("Content-Disposition", `${disposition}; filename="${doc.filename}"`);
    res.send(doc.buffer);
  },
  async send(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    res.json(await service.send(req.params.id, requireOrgId(req), requireAuthContext(req).userId));
  },
  async resend(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    res.json(await service.resend(req.params.id, requireOrgId(req), requireAuthContext(req).userId));
  },
  async markViewed(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    res.json(await service.markViewed(req.params.id, requireOrgId(req), requireAuthContext(req).userId));
  },
  async accept(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    res.json(await service.accept(req.params.id, requireOrgId(req), requireAuthContext(req).userId));
  },
  async reject(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    res.json(await service.reject(req.params.id, requireOrgId(req), requireAuthContext(req).userId));
  },
  async duplicate(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    res.status(201).json(await service.duplicate(req.params.id, requireOrgId(req)));
  },
};
