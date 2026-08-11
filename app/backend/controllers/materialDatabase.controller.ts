import { Request, Response } from "express";
import { z } from "zod";
import { MaterialDatabaseService } from "../../modules/material-database/service";
import { parsePositiveNumber, requireAuthContext, requireOrgId, requirePermissions } from "../requestContext";

const service = new MaterialDatabaseService();

const createSchema = z.object({
  orgId: z.string().uuid().optional(),
  sku: z.string().optional(),
  name: z.string().min(1),
  unitOfMeasure: z.string().min(1),
  unitCost: z.number().nonnegative(),
  wasteFactorPct: z.number().min(0).optional(),
  supplierId: z.string().uuid().optional(),
});

export const materialDatabaseController = {
  async list(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    res.json(await service.list(requireOrgId(req)));
  },
  async getById(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    res.json(await service.getById(req.params.id, requireOrgId(req)));
  },
  async create(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    res.status(201).json(await service.create({ ...createSchema.parse(req.body), orgId: requireOrgId(req) }));
  },
  async update(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const orgId = requireOrgId(req);
    res.json(await service.update(
      req.params.id,
      createSchema.partial().parse(req.body),
      orgId,
      { actor: requireAuthContext(req), source: "manual" }
    ));
  },
  async remove(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    await service.delete(req.params.id, requireOrgId(req));
    res.status(204).send();
  },
  async calculate(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const schema = z.object({ materialId: z.string().uuid(), quantity: z.coerce.number().positive() });
    res.json(await service.calculateMaterialCost(schema.parse(req.body), requireOrgId(req)));
  },
  async bulkImport(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const schema = z.object({ rows: z.array(z.record(z.unknown())) });
    const { rows } = schema.parse(req.body);
    res.json(await service.bulkImport(requireOrgId(req), rows as never));
  },
  async stale(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const days = parsePositiveNumber(req.query.days, 30);
    res.json(await service.findStalePrices(days, requireOrgId(req)));
  },
};
