import { Request, Response } from "express";
import { z } from "zod";
import { TransactionalEstimateEngineService } from "../../modules/athena-events/transactionalPublishers";
import { ActivityTimelineService } from "../../modules/intelligence/service";
import { requireOrgId, requirePermissions } from "../requestContext";
import { commaSeparatedEnum } from "../queryParams";
import { estimateStatuses } from "../../domain";
import { estimateCostTypes } from "../../modules/estimate-engine/types";

const service = new TransactionalEstimateEngineService();
const activityService = new ActivityTimelineService();

const listQueueQuerySchema = z.object({
  status: commaSeparatedEnum(z.enum(estimateStatuses)),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional(),
});

export const estimateEngineController = {
  async create(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const schema = z.object({ projectId: z.string().uuid(), overheadPct: z.coerce.number().min(0).optional() });
    const estimate = await service.create({ ...schema.parse(req.body), orgId: requireOrgId(req) });
    await activityService.record({
      orgId: requireOrgId(req),
      entityType: "estimate",
      entityId: estimate.id,
      eventType: "estimate.created",
      title: `Estimate v${estimate.version} created`,
      actorUserId: auth.userId,
      metadata: { projectId: estimate.projectId },
    });
    res.status(201).json(estimate);
  },

  async getById(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    res.json(await service.getById(req.params.id, requireOrgId(req)));
  },

  async listByProject(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    res.json(await service.listByProject(req.params.projectId, requireOrgId(req)));
  },

  async listOrganizationQueue(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    const query = listQueueQuerySchema.parse(req.query);
    res.json(
      await service.listOrganizationQueue({
        orgId: requireOrgId(req),
        statuses: query.status,
        updatedAfter: query.updatedAfter,
        updatedBefore: query.updatedBefore,
        limit: query.limit,
        cursor: query.cursor,
      })
    );
  },

  async addLineItem(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const schema = z
      .object({
        costItemId: z.string().uuid().optional(),
        assemblyId: z.string().uuid().optional(),
        quantity: z.coerce.number().positive(),
        description: z.string().trim().min(1).max(500).optional(),
        section: z.string().trim().min(1).max(120).optional(),
        costType: z.enum(estimateCostTypes).optional(),
        unitOfMeasure: z.string().trim().min(1).max(40).optional(),
        unitCost: z.coerce.number().min(0).optional(),
        taxable: z.boolean().optional(),
      })
      .refine((v) => {
        if (v.costItemId || v.assemblyId) return Boolean(v.costItemId) !== Boolean(v.assemblyId);
        return Boolean(v.description && v.unitOfMeasure && v.unitCost != null);
      }, {
        message: "Provide one catalog item or a custom description, unit, and unit cost",
      });
    const body = schema.parse(req.body);
    const lineItem = await service.addLineItem({ estimateId: req.params.id, ...body, orgId: requireOrgId(req) });
    await activityService.record({
      orgId: requireOrgId(req),
      entityType: "estimate",
      entityId: req.params.id,
      eventType: "estimate.line_item_added",
      title: "Estimate line item added",
      actorUserId: auth.userId,
      metadata: {
        lineItemId: lineItem.id,
        costItemId: body.costItemId ?? null,
        assemblyId: body.assemblyId ?? null,
        quantity: body.quantity,
      },
    });
    res.status(201).json(lineItem);
  },

  async updateLineItem(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const schema = z.object({
      description: z.string().trim().min(1).max(500).optional(),
      section: z.string().trim().min(1).max(120).optional(),
      costType: z.enum(estimateCostTypes).optional(),
      unitOfMeasure: z.string().trim().min(1).max(40).optional(),
      quantity: z.coerce.number().positive().optional(),
      unitCost: z.coerce.number().min(0).optional(),
      taxable: z.boolean().optional(),
    }).refine((value) => Object.keys(value).length > 0, { message: "At least one line item field is required" });
    const body = schema.parse(req.body);
    const lineItem = await service.updateLineItem({ estimateId: req.params.id, lineItemId: req.params.lineItemId, ...body, orgId: requireOrgId(req) });
    await activityService.record({
      orgId: requireOrgId(req), entityType: "estimate", entityId: req.params.id,
      eventType: "estimate.line_item_updated", title: "Estimate line item updated", actorUserId: auth.userId,
      metadata: { lineItemId: lineItem.id },
    });
    res.json(lineItem);
  },

  async updateEstimate(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const schema = z.object({
      overheadPct: z.coerce.number().min(0).max(999.99).optional(),
      taxPct: z.coerce.number().min(0).max(100).optional(),
    }).refine((value) => Object.keys(value).length > 0, { message: "At least one estimate setting is required" });
    const body = schema.parse(req.body);
    const estimate = await service.updateEstimate({ estimateId: req.params.id, ...body, orgId: requireOrgId(req) });
    await activityService.record({
      orgId: requireOrgId(req), entityType: "estimate", entityId: estimate.id,
      eventType: "estimate.settings_updated", title: "Estimate settings updated", actorUserId: auth.userId,
      metadata: body,
    });
    res.json(estimate);
  },

  async removeLineItem(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const { estimateId } = await service.removeLineItem(req.params.lineItemId, requireOrgId(req), req.params.id);
    await activityService.record({
      orgId: requireOrgId(req),
      entityType: "estimate",
      entityId: estimateId,
      eventType: "estimate.line_item_removed",
      title: "Estimate line item removed",
      actorUserId: auth.userId,
      metadata: { lineItemId: req.params.lineItemId },
    });
    res.status(204).send();
  },

  async setPricingMode(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const schema = z.object({
      mode: z.enum(["markup", "targetMargin"]),
      markupPct: z.coerce.number().min(0).optional(),
      targetMarginPct: z.coerce.number().min(0).max(99.99).optional(),
    }).superRefine((value, ctx) => {
      if (value.mode === "markup" && value.markupPct == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["markupPct"], message: "markupPct is required for markup mode" });
      if (value.mode === "targetMargin" && value.targetMarginPct == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetMarginPct"], message: "targetMarginPct is required for target-margin mode" });
    });
    const body = schema.parse(req.body);
    const estimate = await service.setPricingMode({ estimateId: req.params.id, ...body, orgId: requireOrgId(req) });
    await activityService.record({
      orgId: requireOrgId(req),
      entityType: "estimate",
      entityId: estimate.id,
      eventType: "estimate.pricing_mode_updated",
      title: "Estimate pricing mode updated",
      actorUserId: auth.userId,
      metadata: {
        mode: body.mode,
        markupPct: body.markupPct ?? null,
        targetMarginPct: body.targetMarginPct ?? null,
      },
    });
    res.json(estimate);
  },

  async finalize(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const estimate = await service.finalize(req.params.id, requireOrgId(req));
    await activityService.record({
      orgId: requireOrgId(req),
      entityType: "estimate",
      entityId: estimate.id,
      eventType: "estimate.finalized",
      title: "Estimate finalized",
      actorUserId: auth.userId,
      metadata: { status: estimate.status },
    });
    res.json(estimate);
  },

  async duplicate(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const duplicate = await service.duplicateFromVersion(req.params.id, requireOrgId(req));
    await activityService.record({
      orgId: requireOrgId(req),
      entityType: "estimate",
      entityId: duplicate.id,
      eventType: "estimate.duplicated",
      title: `Estimate duplicated to v${duplicate.version}`,
      actorUserId: auth.userId,
      metadata: { sourceEstimateId: req.params.id, projectId: duplicate.projectId },
    });
    res.status(201).json(duplicate);
  },
};
