import { Request, Response } from "express";
import { z } from "zod";
import { SupplierIntegrationService } from "../../modules/supplier-integration/service";
import { requireAuthContext, requireOrgId, requirePermissions } from "../requestContext";

const service = new SupplierIntegrationService();
const idSchema = z.string().uuid();

const listQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  supplierId: z.string().uuid().optional(),
  materialId: z.string().uuid().optional(),
}).strict();

const enqueueSchema = z.object({
  supplierId: z.string().uuid(),
  materialId: z.string().uuid(),
  proposedUnitCost: z.coerce.number().finite().nonnegative().max(99_999_999.9999),
  source: z.string().trim().min(1).max(64).optional(),
}).strict();

export const supplierIntegrationController = {
  async listQueue(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    res.json(await service.listQueue(requireOrgId(req), listQuerySchema.parse(req.query)));
  },
  async enqueue(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const orgId = requireOrgId(req);
    res.status(201).json(await service.enqueue({ ...enqueueSchema.parse(req.body), orgId }));
  },
  async approve(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    res.json(await service.approve(idSchema.parse(req.params.id), requireOrgId(req), auth));
  },
  async reject(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    res.json(await service.reject(idSchema.parse(req.params.id), requireOrgId(req), auth));
  },
};
