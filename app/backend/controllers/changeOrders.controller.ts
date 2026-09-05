import { Request, Response } from "express";
import { z } from "zod";
import { ChangeOrdersService } from "../../modules/change-orders/service";
import { requireOrgId, requirePermissions } from "../requestContext";

const service = new ChangeOrdersService();

const createSchema = z.object({
  projectId: z.string().uuid(),
  estimateId: z.string().uuid().optional(),
  description: z.string().min(1),
  scheduleImpactDays: z.coerce.number().int().min(0).optional(),
});

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  scheduleImpactDays: z.coerce.number().int().min(0).nullable().optional(),
});

const addLineItemSchema = z
  .object({
    costItemId: z.string().uuid().optional(),
    description: z.string().min(1).optional(),
    quantity: z.coerce.number().positive(),
    unitCost: z.coerce.number().nonnegative().optional(),
  })
  .refine((v) => Boolean(v.costItemId) || (Boolean(v.description) && v.unitCost != null), {
    message: "Provide costItemId or both description and unitCost",
  });

export const changeOrdersController = {
  async listByProject(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    res.json(await service.listByProject(req.params.projectId, requireOrgId(req)));
  },
  async getById(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    res.json(await service.getById(req.params.id, requireOrgId(req)));
  },
  async create(req: Request, res: Response) {
    requirePermissions(req, ["billing.write"]);
    res.status(201).json(await service.create({ ...createSchema.parse(req.body), orgId: requireOrgId(req) }));
  },
  async update(req: Request, res: Response) {
    requirePermissions(req, ["billing.write"]);
    res.json(await service.update(req.params.id, { ...updateSchema.parse(req.body), orgId: requireOrgId(req) }));
  },
  async addLineItem(req: Request, res: Response) {
    requirePermissions(req, ["billing.write"]);
    const body = addLineItemSchema.parse(req.body);
    res.status(201).json(await service.addLineItem({ ...body, changeOrderId: req.params.id, orgId: requireOrgId(req) }));
  },
  async removeLineItem(req: Request, res: Response) {
    requirePermissions(req, ["billing.write"]);
    await service.removeLineItem(req.params.id, req.params.lineItemId, requireOrgId(req));
    res.status(204).send();
  },
  async remove(req: Request, res: Response) {
    requirePermissions(req, ["billing.write"]);
    await service.delete(req.params.id, requireOrgId(req));
    res.status(204).send();
  },
  async approve(req: Request, res: Response) {
    requirePermissions(req, ["billing.write"]);
    res.json(await service.approve(req.params.id, requireOrgId(req)));
  },
  async reject(req: Request, res: Response) {
    requirePermissions(req, ["billing.write"]);
    res.json(await service.reject(req.params.id, requireOrgId(req)));
  },
};
