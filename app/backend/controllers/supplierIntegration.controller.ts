import { Request, Response } from "express";
import { z } from "zod";
import { SupplierIntegrationService } from "../../modules/supplier-integration/service";
import { requireAuthContext, requireOrgId, requirePermissions } from "../requestContext";

const service = new SupplierIntegrationService();

const listQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  supplierId: z.string().uuid().optional(),
  materialId: z.string().uuid().optional(),
});

const enqueueSchema = z.object({
  supplierId: z.string().uuid(),
  materialId: z.string().uuid(),
  proposedUnitCost: z.number().nonnegative(),
  source: z.string().min(1).max(64).optional(),
});

export const supplierIntegrationController = {
  async listQueue(req: Request, res: Response) {
    res.json(await service.listQueue(requireOrgId(req), listQuerySchema.parse(req.query)));
  },
  async enqueue(req: Request, res: Response) {
    const orgId = requireOrgId(req);
    res.status(201).json(await service.enqueue({ ...enqueueSchema.parse(req.body), orgId }));
  },
  async approve(req: Request, res: Response) {
    const orgId = requireOrgId(req);
    requirePermissions(req, ["costbook.write"]);
    res.json(await service.approve(req.params.id, orgId, requireAuthContext(req)));
  },
  async reject(req: Request, res: Response) {
    const orgId = requireOrgId(req);
    requirePermissions(req, ["costbook.write"]);
    res.json(await service.reject(req.params.id, orgId, requireAuthContext(req)));
  },
};
