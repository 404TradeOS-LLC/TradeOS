import { Request, Response } from "express";
import { z } from "zod";
import { AssembliesDatabaseService } from "../../modules/assemblies-database/service";
import { requireOrgId, requirePermissions } from "../requestContext";
import { catalogBooleanQuery, catalogQuerySchema, parseCatalogQuery } from "../../modules/shared/catalog-query";

const service = new AssembliesDatabaseService();
const idSchema = z.string().uuid();

const createSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  unitOfMeasure: z.string().trim().min(1).max(40),
  description: z.string().trim().max(500).nullable().optional(),
  isTemplate: z.boolean().optional(),
}).strict();

const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() }).refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one assembly field is required" }
);

const addItemSchema = z.object({
  costItemId: z.string().uuid().optional(),
  childAssemblyId: z.string().uuid().optional(),
  quantityPerUnit: z.coerce.number().finite().positive().max(1_000_000),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
}).strict().refine((value) => Boolean(value.costItemId) !== Boolean(value.childAssemblyId), {
  message: "Provide exactly one of costItemId or childAssemblyId",
});

const listSchema = catalogQuerySchema.extend({ active: catalogBooleanQuery.optional(), isTemplate: catalogBooleanQuery.optional() }).strict();
const templateListSchema = catalogQuerySchema.strict();
const itemsListSchema = catalogQuerySchema.strict();
const searchSchema = z.object({ q: z.string().trim().max(200).optional() }).strict();
const unitCostQuerySchema = z.object({ regionId: z.string().uuid().optional() }).strict();

export const assembliesDatabaseController = {
  async list(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const parsed = listSchema.parse(req.query);
    const query = parseCatalogQuery(
      { limit: parsed.limit, cursor: parsed.cursor, q: parsed.q, sort: parsed.sort, order: parsed.order },
      { defaultSort: "name", allowedSorts: ["name", "code", "createdAt", "updatedAt"], filters: { active: parsed.active, isTemplate: parsed.isTemplate } }
    );
    res.json(await service.listPage(requireOrgId(req), query));
  },
  async search(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const { q } = searchSchema.parse(req.query);
    res.json(await service.search(q ?? "", requireOrgId(req)));
  },
  async templates(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const parsed = templateListSchema.parse(req.query);
    const query = parseCatalogQuery(
      { limit: parsed.limit, cursor: parsed.cursor, q: parsed.q, sort: parsed.sort, order: parsed.order },
      { defaultSort: "name", allowedSorts: ["name", "code", "createdAt", "updatedAt"] }
    );
    res.json(await service.listTemplatesPage(requireOrgId(req), query));
  },
  async getById(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    res.json(await service.getById(idSchema.parse(req.params.id), requireOrgId(req)));
  },
  async listItems(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const parsed = itemsListSchema.parse(req.query);
    const query = parseCatalogQuery(
      { limit: parsed.limit, cursor: parsed.cursor, q: parsed.q, sort: parsed.sort, order: parsed.order },
      { defaultSort: "sortOrder", allowedSorts: ["sortOrder"] }
    );
    res.json(await service.listAssemblyItemsPage(idSchema.parse(req.params.id), requireOrgId(req), query));
  },
  async create(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    res.status(201).json(await service.create({ ...createSchema.parse(req.body), orgId: requireOrgId(req) }));
  },
  async update(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const input = updateSchema.parse(req.body);
    if (input.isActive !== undefined) requirePermissions(req, ["costbook.manage"]);
    res.json(await service.update(idSchema.parse(req.params.id), input, requireOrgId(req)));
  },
  async remove(req: Request, res: Response) {
    requirePermissions(req, ["costbook.manage"]);
    await service.delete(idSchema.parse(req.params.id), requireOrgId(req));
    res.status(204).send();
  },
  async addItem(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const body = addItemSchema.parse(req.body);
    res.status(201).json(await service.addAssemblyItem({ assemblyId: idSchema.parse(req.params.id), ...body, orgId: requireOrgId(req) }));
  },
  async removeItem(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    await service.removeAssemblyItem(idSchema.parse(req.params.itemId), requireOrgId(req));
    res.status(204).send();
  },
  async getUnitCost(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const { regionId } = unitCostQuerySchema.parse(req.query);
    res.json(await service.getAssemblyUnitCost(idSchema.parse(req.params.id), regionId, new Set(), requireOrgId(req)));
  },
};
