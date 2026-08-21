import { Request, Response } from "express";
import { z } from "zod";
import { CostDatabaseService } from "../../modules/cost-database/service";
import { parsePositiveNumber, requireOrgId, requirePermissions } from "../requestContext";
import { catalogBooleanQuery, catalogQuerySchema, parseCatalogQuery } from "../../modules/shared/catalog-query";

const service = new CostDatabaseService();

const createCostItemSchema = z.object({
  subcategoryId: z.string().uuid(),
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  unitOfMeasure: z.string().trim().min(1).max(40),
  productionRate: z.number().finite().positive().max(99_999_999.9999).optional(),
  laborRateId: z.string().uuid().optional(),
  materialId: z.string().uuid().optional(),
  equipmentId: z.string().uuid().optional(),
  subcontractorId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict();

const updateCostItemSchema = z.object({
  code: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  unitOfMeasure: z.string().trim().min(1).max(40).optional(),
  productionRate: z.number().finite().positive().max(99_999_999.9999).nullable().optional(),
  laborRateId: z.string().uuid().nullable().optional(),
  materialId: z.string().uuid().nullable().optional(),
  equipmentId: z.string().uuid().nullable().optional(),
  subcontractorId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one cost-item field is required",
});

const listQuerySchema = catalogQuerySchema.extend({
  active: catalogBooleanQuery.optional(),
  subcategoryId: z.string().uuid().optional(),
  componentType: z.enum(["labor", "material", "equipment", "subcontractor", "none"]).optional(),
}).strict();

export const costDatabaseController = {
  async list(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const parsed = listQuerySchema.parse(req.query);
    const query = parseCatalogQuery(
      { limit: parsed.limit, cursor: parsed.cursor, q: parsed.q, sort: parsed.sort, order: parsed.order },
      {
        defaultSort: "code",
        allowedSorts: ["code", "name", "createdAt", "updatedAt"],
        filters: { active: parsed.active, subcategoryId: parsed.subcategoryId, componentType: parsed.componentType },
      }
    );
    res.json(await service.listPage(query, requireOrgId(req)));
  },

  async listDivisions(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
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
    requirePermissions(req, ["costbook.read"]);
    const items = await service.listSubcategoryCostItems(req.params.subcategoryId, requireOrgId(req));
    res.json(items);
  },

  async search(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const query = z.string().trim().max(200).catch("").parse(req.query.q);
    const items = await service.search(query, requireOrgId(req));
    res.json(items);
  },

  async getById(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const item = await service.getById(z.string().uuid().parse(req.params.id), requireOrgId(req));
    res.json(item);
  },

  async create(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const item = await service.create({ ...createCostItemSchema.parse(req.body), orgId: requireOrgId(req) });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const input = updateCostItemSchema.parse(req.body);
    if (input.isActive !== undefined) requirePermissions(req, ["costbook.manage"]);
    const item = await service.update(z.string().uuid().parse(req.params.id), input, requireOrgId(req));
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    requirePermissions(req, ["costbook.manage"]);
    await service.delete(z.string().uuid().parse(req.params.id), requireOrgId(req));
    res.status(204).send();
  },

  async getUnitCost(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const quantity = parsePositiveNumber(req.query.quantity, 1);
    const regionId = req.query.regionId === undefined ? undefined : z.string().uuid().parse(req.query.regionId);
    const breakdown = await service.getUnitCost(z.string().uuid().parse(req.params.id), quantity, regionId, requireOrgId(req));
    res.json(breakdown);
  },

  async bulkImport(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const schema = z.object({ rows: z.array(createCostItemSchema) }).strict();
    const { rows } = schema.parse(req.body);
    const result = await service.bulkImport(requireOrgId(req), rows);
    res.json(result);
  },
};
