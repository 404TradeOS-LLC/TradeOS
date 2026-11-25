import { Request, Response } from "express";
import { z } from "zod";
import { TransactionalProposalsService } from "../../modules/athena-events/transactionalPublishers";
import { requireAuthContext, requireOrgId, requirePermissions } from "../requestContext";
import { commaSeparatedEnum, strictOptionalBoolean } from "../queryParams";
import { proposalStatuses } from "../../domain";
import { sanitizeDownloadFilename } from "../../modules/documents/format";

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
  estimateId: z.guid().optional(),
  projectId: z.guid().optional(),
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
  // DES-10 Status Check: the contractor explicitly confirmed on the Status
  // Check screen that no proposal for this project and estimate was present
  // in the loaded list, then created again. Recorded as an activity event
  // on a fresh create; excluded from the idempotency hash in the service.
  confirmedNoMatch: z.boolean().optional(),
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

const offlineAcceptanceSchema = z.object({
  channel: z.enum(["in_person", "phone", "signed_document"]),
  note: z.string().trim().min(10).max(500),
  confirmed: z.literal(true),
}).strict();

// DES-10-F8: Copperline proposal sections 03 (selections) and 04
// (allowances). Statuses mirror the Figma badges: ACTION REQUIRED and
// CONFIRMED. Due dates arrive as ISO datetimes; the web forms convert a
// date-picker value before sending.
const selectionStatusSchema = z.enum(["action_required", "confirmed"]);

const createSelectionSchema = z.object({
  label: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(500).nullable().optional(),
  status: selectionStatusSchema.optional(),
  dueDate: z.string().datetime().nullable().optional(),
}).strict();

const updateSelectionSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  detail: z.string().trim().max(500).nullable().optional(),
  status: selectionStatusSchema.optional(),
  dueDate: z.string().datetime().nullable().optional(),
}).strict();

const createAllowanceSchema = z.object({
  description: z.string().trim().min(1).max(200),
  amount: z.number().finite().min(0),
}).strict();

const updateAllowanceSchema = z.object({
  description: z.string().trim().min(1).max(200).optional(),
  amount: z.number().finite().min(0).optional(),
}).strict();

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
    const input = { ...createSchema.parse(req.body), orgId: requireOrgId(req) };
    const rawIdempotencyKey = req.headers["idempotency-key"];
    // Keep older web bundles and external clients working during independent
    // web/API deployments. First-party forms always send a key; unkeyed legacy
    // creates retain the original non-idempotent behavior.
    if (rawIdempotencyKey === undefined) {
      res.status(201).json(await service.create(input));
      return;
    }
    const idempotencyKey = z.guid().parse(rawIdempotencyKey);
    const result = await service.createWithIdempotency(input, idempotencyKey);
    res.setHeader("Idempotency-Replayed", result.replayed ? "true" : "false");
    res.status(result.replayed ? 200 : 201).json(result.proposal);
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
    res.setHeader("Content-Disposition", `${disposition}; filename="${sanitizeDownloadFilename(doc.filename)}"`);
    res.send(doc.buffer);
  },
  async listSelections(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    res.json(await service.listSelections(req.params.id, requireOrgId(req)));
  },
  async createSelection(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    const input = createSelectionSchema.parse(req.body);
    res.status(201).json(await service.createSelection(req.params.id, input, requireOrgId(req)));
  },
  async updateSelection(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    const input = updateSelectionSchema.parse(req.body);
    res.json(await service.updateSelection(req.params.selectionId, req.params.id, input, requireOrgId(req)));
  },
  async deleteSelection(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    await service.deleteSelection(req.params.selectionId, req.params.id, requireOrgId(req));
    res.status(204).send();
  },
  async listAllowances(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    res.json(await service.listAllowances(req.params.id, requireOrgId(req)));
  },
  async createAllowance(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    const input = createAllowanceSchema.parse(req.body);
    res.status(201).json(await service.createAllowance(req.params.id, input, requireOrgId(req)));
  },
  async updateAllowance(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    const input = updateAllowanceSchema.parse(req.body);
    res.json(await service.updateAllowance(req.params.allowanceId, req.params.id, input, requireOrgId(req)));
  },
  async deleteAllowance(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    await service.deleteAllowance(req.params.allowanceId, req.params.id, requireOrgId(req));
    res.status(204).send();
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
  async acceptOffline(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    const { channel, note } = offlineAcceptanceSchema.parse(req.body);
    res.json(await service.acceptOffline(
      req.params.id, { channel, note }, requireOrgId(req), requireAuthContext(req).userId
    ));
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
