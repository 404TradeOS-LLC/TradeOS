import { Request, Response } from "express";
import { z } from "zod";
import { CostbookService } from "../../modules/costbook";
import { requireAuthContext, requirePermissions } from "../requestContext";

const service = new CostbookService();

const idParamSchema = z.object({ id: z.string().uuid() });

const materialSchema = z.object({
  sku: z.string().trim().max(80).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  unitOfMeasure: z.string().trim().min(1).max(40),
  unitCost: z.coerce.number().finite().nonnegative(),
  wasteFactorPct: z.coerce.number().finite().min(0).max(100).optional(),
  supplierId: z.string().uuid().nullable().optional(),
}).strict();

const materialUpdateSchema = materialSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one material field is required",
});

export const costbookController = {
  async workspace(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    res.json(await service.getWorkspace(requireAuthContext(req)));
  },
  async listMaterials(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    res.json(await service.listMaterials(auth));
  },
  async getMaterial(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.getMaterial(auth, id));
  },
  async createMaterial(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    res.status(201).json(await service.createMaterial(auth, materialSchema.parse(req.body)));
  },
  async updateMaterial(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.updateMaterial(auth, id, materialUpdateSchema.parse(req.body)));
  },
};
