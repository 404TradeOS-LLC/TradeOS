import { Request, Response } from "express";
import { z } from "zod";
import { TransactionalEstimateEngineService } from "../../modules/athena-events/transactionalPublishers";
import { ActivityTimelineService } from "../../modules/intelligence/service";
import { requireOrgId, requirePermissions } from "../requestContext";
import { commaSeparatedEnum } from "../queryParams";
import { estimateStatuses, type EstimateStatus } from "../../domain";

const service = new TransactionalEstimateEngineService();
const activityService = new ActivityTimelineService();

// "sent" is excluded from the queue's status filter even though it's a
// listed canonical estimateStatus: legacyEstimateStatusMap normalizes raw
// "sent" to canonical "ready", so no row's normalized status can ever
// actually read "sent" — filtering by it would silently return the exact
// same rows as "ready" while promising something distinct. See
// docs/modules/estimating.md's Known limitations.
const estimateQueueStatuses = estimateStatuses.filter((status): status is Exclude<EstimateStatus, "sent"> => status !== "sent");

const listQueueQuerySchema = z.object({
  status: commaSeparatedEnum(z.enum(estimateQueueStatuses as [Exclude<EstimateStatus, "sent">, ...Exclude<EstimateStatus, "sent">[]])),
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
        description: z.string().optional(),
      })
      .refine((v) => Boolean(v.costItemId) !== Boolean(v.assemblyId), {
        message: "Provide exactly one of costItemId or assemblyId",
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

  async removeLineItem(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const { estimateId } = await service.removeLineItem(req.params.lineItemId, requireOrgId(req));
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
