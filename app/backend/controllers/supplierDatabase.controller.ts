import { Request, Response } from "express";
import { z } from "zod";
import { SupplierDatabaseService } from "../../modules/supplier-database/service";
import { requireOrgId, requirePermissions } from "../requestContext";

const service = new SupplierDatabaseService();

const createSchema = z.object({
  orgId: z.string().uuid().optional(),
  name: z.string().min(1),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().min(1).optional(),
  website: z.string().min(1).optional(),
  apiIntegrationKey: z.string().min(1).optional(),
});

export const supplierDatabaseController = {
  async list(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    res.json(await service.list(requireOrgId(req)));
  },
  async getById(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    res.json(await service.getById(req.params.id, requireOrgId(req)));
  },
  async create(req: Request, res: Response) {
    requirePermissions(req, ["costbook.manage"]);
    res.status(201).json(await service.create({ ...createSchema.parse(req.body), orgId: requireOrgId(req) }));
  },
  async update(req: Request, res: Response) {
    requirePermissions(req, ["costbook.manage"]);
    res.json(await service.update(req.params.id, createSchema.partial().parse(req.body), requireOrgId(req)));
  },
  async remove(req: Request, res: Response) {
    requirePermissions(req, ["costbook.manage"]);
    await service.delete(req.params.id, requireOrgId(req));
    res.status(204).send();
  },
};
