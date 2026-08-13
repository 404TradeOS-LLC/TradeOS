import { Request, Response } from "express";
import { z } from "zod";
import { CostDatabaseService } from "../../modules/cost-database/service";
import { parsePositiveNumber, requireOrgId, requirePermissions } from "../requestContext";

const service = new CostDatabaseService();

const createCostItemSchema = z.object({
  subcategoryId: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  unitOfMeasure: z.string().min(1),
  productionRate: z.number().positive().optional(),
  laborRateId: z.string().uuid().optional(),
  materialId: z.string().uuid().optional(),
  equipmentId: z.string().uuid().optional(),
  subcontractorId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const updateCostItemSchema = createCostItemSchema.partial().extend({ isActive: z.boolean().optional() });

export const costDatabaseController = {
  async listDivisions(req: Request, res: Response) {
    const divisions = await service.listDivisions(requireOrgId(req));
    res.json(divisions);
  },

  async createDivision(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const schema = z.object({ code: z.string().min(1), name: z.string().min(1), sortOrder: z.coerce.number().int().min(0).optional() });
    const division = await service.createDivision({ ...schema.parse(req.body), orgId: requireOrgId(req) });
    res.status(201).json(division);
  },

  async createCategory(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const schema = z.object({ divisionId: z.string().uuid(), code: z.string(), name: z.string(), sortOrder: z.number().optional() });
    const category = await service.createCategory(schema.parse(req.body));
    res.status(201).json(category);
  },

  async createSubcategory(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const schema = z.object({ categoryId: z.string().uuid(), code: z.string(), name: z.string(), sortOrder: z.number().optional() });
    const subcategory = await service.createSubcategory(schema.parse(req.body));
    res.status(201).json(subcategory);
  },

  async listSubcategoryCostItems(req: Request, res: Response) {
    const items = await service.listSubcategoryCostItems(req.params.subcategoryId);
    res.json(items);
  },

  async search(req: Request, res: Response) {
    const query = (req.query.q as string) ?? "";
    const items = await service.search(query, requireOrgId(req));
    res.json(items);
  },

  async getById(req: Request, res: Response) {
    const item = await service.getById(req.params.id, requireOrgId(req));
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const item = await service.create({ ...createCostItemSchema.parse(req.body), orgId: requireOrgId(req) });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const item = await service.update(req.params.id, updateCostItemSchema.parse(req.body), requireOrgId(req));
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    await service.delete(req.params.id, requireOrgId(req));
    res.status(204).send();
  },

  async getUnitCost(req: Request, res: Response) {
    const quantity = parsePositiveNumber(req.query.quantity, 1);
    const regionId = req.query.regionId as string | undefined;
    const breakdown = await service.getUnitCost(req.params.id, quantity, regionId, requireOrgId(req));
    res.json(breakdown);
  },

  async bulkImport(req: Request, res: Response) {
    const schema = z.object({ rows: z.array(z.record(z.unknown())) });
    const { rows } = schema.parse(req.body);
    const result = await service.bulkImport(requireOrgId(req), rows as never);
    res.json(result);
  },
};
