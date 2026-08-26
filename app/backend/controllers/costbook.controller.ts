import { Request, Response } from "express";
import { z } from "zod";
import { CostbookService } from "../../modules/costbook";
import { requireAuthContext, requirePermissions } from "../requestContext";
import { catalogBooleanQuery, catalogQuerySchema, parseCatalogQuery } from "../../modules/shared/catalog-query";

const service = new CostbookService();

const idParamSchema = z.object({ id: z.string().uuid() });
const maxUnitCost = 99_999_999.9999;

const requiredNumberSchema = z.preprocess(
  rejectBlankNumericInput,
  z.coerce.number().finite().nonnegative().max(maxUnitCost)
);
const requiredLaborMoneySchema = z.preprocess(
  rejectBlankNumericInput,
  z.coerce.number().finite().nonnegative().max(99_999_999.99).refine((value) => hasAtMostDecimalPlaces(value, 2), {
    message: "Number must fit the database precision",
  })
);
const optionalPercentSchema = z.preprocess(
  rejectBlankNumericInput,
  z.coerce.number().finite().min(0).max(100).optional()
);

const materialSchema = z.object({
  sku: z.string().trim().max(80).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  unitOfMeasure: z.string().trim().min(1).max(40),
  unitCost: requiredNumberSchema,
  wasteFactorPct: optionalPercentSchema,
  supplierId: z.string().uuid().nullable().optional(),
}).strict();

const materialUpdateSchema = materialSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one material field is required",
});

const laborRateSchema = z.object({
  role: z.string().trim().min(1).max(120),
  description: z.string().trim().max(240).nullable().optional(),
  hourlyCost: requiredLaborMoneySchema,
  billRate: requiredLaborMoneySchema,
  active: z.boolean().optional(),
}).strict();

const laborRateUpdateSchema = laborRateSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one labor-rate field is required",
});

const equipmentMoneySchema = z.preprocess(
  rejectBlankNumericInput,
  z.coerce.number().finite().nonnegative().max(99_999_999.99).refine((value) => hasAtMostDecimalPlaces(value, 2), {
    message: "Number must fit the database precision",
  })
);
const optionalEquipmentMoneyUpdateSchema = z.preprocess(
  rejectInvalidOptionalNumericInput,
  z.coerce.number().finite().nonnegative().max(99_999_999.99).refine((value) => hasAtMostDecimalPlaces(value, 2), {
    message: "Number must fit the database precision",
  }).optional()
);
const equipmentDailyRateUpdateSchema = z.preprocess(
  normalizeOptionalDailyRateUpdate,
  z.coerce.number().finite().nonnegative().max(99_999_999.99).refine((value) => hasAtMostDecimalPlaces(value, 2), {
    message: "Number must fit the database precision",
  }).nullable().optional()
);
const equipmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  ownershipCostPerHour: equipmentMoneySchema,
  operatingCostPerHour: equipmentMoneySchema,
  dailyRate: z.preprocess(
    rejectBlankNumericInput,
    z.coerce.number().finite().nonnegative().max(99_999_999.99).refine((value) => hasAtMostDecimalPlaces(value, 2), {
      message: "Number must fit the database precision",
    }).nullable().optional()
  ),
}).strict();
const equipmentUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  ownershipCostPerHour: optionalEquipmentMoneyUpdateSchema,
  operatingCostPerHour: optionalEquipmentMoneyUpdateSchema,
  dailyRate: equipmentDailyRateUpdateSchema,
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one equipment field is required",
});

const materialsListQuerySchema = catalogQuerySchema.extend({ supplierId: z.string().uuid().optional() }).strict();
const laborListQuerySchema = catalogQuerySchema.extend({ active: catalogBooleanQuery.optional(), trade: z.string().trim().max(120).optional() }).strict();
const equipmentListQuerySchema = catalogQuerySchema.strict();
const divisionsListQuerySchema = catalogQuerySchema.extend({ active: catalogBooleanQuery.optional() }).strict();
const categoriesListQuerySchema = catalogQuerySchema.extend({ divisionId: z.string().uuid().optional(), active: catalogBooleanQuery.optional() }).strict();
const subcategoriesListQuerySchema = catalogQuerySchema.extend({ categoryId: z.string().uuid().optional(), active: catalogBooleanQuery.optional() }).strict();

const divisionSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  sortOrder: z.coerce.number().int().min(0).optional(),
}).strict();

const divisionUpdateSchema = divisionSchema.partial().extend({ isActive: z.boolean().optional() }).refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one division field is required" }
);

const categorySchema = z.object({
  divisionId: z.string().uuid(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  sortOrder: z.coerce.number().int().min(0).optional(),
}).strict();

const categoryUpdateSchema = categorySchema.omit({ divisionId: true }).partial().extend({ isActive: z.boolean().optional() }).refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one category field is required" }
);

const subcategorySchema = z.object({
  categoryId: z.string().uuid(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  sortOrder: z.coerce.number().int().min(0).optional(),
}).strict();

const subcategoryUpdateSchema = subcategorySchema.omit({ categoryId: true }).partial().extend({ isActive: z.boolean().optional() }).refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one subcategory field is required" }
);

export const costbookController = {
  async workspace(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    res.json(await service.getWorkspace(requireAuthContext(req)));
  },
  async listMaterials(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const parsed = materialsListQuerySchema.parse(req.query);
    res.json(await service.listMaterialsPage(auth.orgId, toCatalogQuery(parsed, "name", ["name", "createdAt", "updatedAt"], { supplierId: parsed.supplierId })));
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
  async listEquipment(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const parsed = equipmentListQuerySchema.parse(req.query);
    res.json(await service.listEquipmentPage(auth.orgId, toCatalogQuery(parsed, "name", ["name", "createdAt", "updatedAt"], {})));
  },
  async getEquipment(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.getEquipment(auth, id));
  },
  async createEquipment(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    res.status(201).json(await service.createEquipment(auth, equipmentSchema.parse(req.body)));
  },
  async updateEquipment(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.updateEquipment(auth, id, equipmentUpdateSchema.parse(req.body)));
  },
  async removeEquipment(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    const { id } = idParamSchema.parse(req.params);
    await service.removeEquipment(auth, id);
    res.status(204).send();
  },
  async listLaborRates(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const parsed = laborListQuerySchema.parse(req.query);
    res.json(await service.listLaborRatesPage(auth.orgId, toCatalogQuery(parsed, "role", ["role", "createdAt", "updatedAt"], { active: parsed.active, trade: parsed.trade })));
  },
  async getLaborRate(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.getLaborRate(auth, id));
  },
  async createLaborRate(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    res.status(201).json(await service.createLaborRate(auth, laborRateSchema.parse(req.body)));
  },
  async updateLaborRate(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.updateLaborRate(auth, id, laborRateUpdateSchema.parse(req.body)));
  },
  async removeLaborRate(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    const { id } = idParamSchema.parse(req.params);
    await service.deactivateLaborRate(auth, id);
    res.status(204).send();
  },
  async updateMaterial(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.updateMaterial(auth, id, materialUpdateSchema.parse(req.body)));
  },
  async listDivisions(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const parsed = divisionsListQuerySchema.parse(req.query);
    res.json(await service.listDivisionsPage(auth.orgId, toCatalogQuery(parsed, "name", ["name", "code", "sortOrder", "createdAt"], { active: parsed.active })));
  },
  async getDivision(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.getDivision(auth, id));
  },
  async createDivision(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    res.status(201).json(await service.createDivision(auth, divisionSchema.parse(req.body)));
  },
  async updateDivision(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    const { id } = idParamSchema.parse(req.params);
    const input = divisionUpdateSchema.parse(req.body);
    if (input.isActive !== undefined) requirePermissions(req, ["costbook.manage"]);
    res.json(await service.updateDivision(auth, id, input));
  },
  async removeDivision(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    const { id } = idParamSchema.parse(req.params);
    await service.deactivateDivision(auth, id);
    res.status(204).send();
  },
  async listCategories(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const parsed = categoriesListQuerySchema.parse(req.query);
    res.json(await service.listCategoriesPage(auth.orgId, toCatalogQuery(parsed, "name", ["name", "code", "sortOrder", "createdAt"], { divisionId: parsed.divisionId, active: parsed.active })));
  },
  async getCategory(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.getCategory(auth, id));
  },
  async createCategory(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    res.status(201).json(await service.createCategory(auth, categorySchema.parse(req.body)));
  },
  async updateCategory(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    const { id } = idParamSchema.parse(req.params);
    const input = categoryUpdateSchema.parse(req.body);
    if (input.isActive !== undefined) requirePermissions(req, ["costbook.manage"]);
    res.json(await service.updateCategory(auth, id, input));
  },
  async removeCategory(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    const { id } = idParamSchema.parse(req.params);
    await service.deactivateCategory(auth, id);
    res.status(204).send();
  },
  async listSubcategories(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const parsed = subcategoriesListQuerySchema.parse(req.query);
    res.json(await service.listSubcategoriesPage(auth.orgId, toCatalogQuery(parsed, "name", ["name", "code", "sortOrder", "createdAt"], { categoryId: parsed.categoryId, active: parsed.active })));
  },
  async getSubcategory(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.getSubcategory(auth, id));
  },
  async createSubcategory(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    res.status(201).json(await service.createSubcategory(auth, subcategorySchema.parse(req.body)));
  },
  async updateSubcategory(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.write"]);
    const { id } = idParamSchema.parse(req.params);
    const input = subcategoryUpdateSchema.parse(req.body);
    if (input.isActive !== undefined) requirePermissions(req, ["costbook.manage"]);
    res.json(await service.updateSubcategory(auth, id, input));
  },
  async removeSubcategory(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    const { id } = idParamSchema.parse(req.params);
    await service.deactivateSubcategory(auth, id);
    res.status(204).send();
  },
};

function toCatalogQuery(
  parsed: z.infer<typeof catalogQuerySchema>,
  defaultSort: string,
  allowedSorts: readonly string[],
  filters: Record<string, string | boolean | undefined>
) {
  return parseCatalogQuery(
    { limit: parsed.limit, cursor: parsed.cursor, q: parsed.q, sort: parsed.sort, order: parsed.order },
    { defaultSort, allowedSorts, filters }
  );
}

function rejectBlankNumericInput(value: unknown) {
  if (value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function rejectInvalidOptionalNumericInput(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return Number.NaN;
  if (typeof value === "string" && value.trim() === "") return Number.NaN;
  return value;
}

function normalizeOptionalDailyRateUpdate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

function hasAtMostDecimalPlaces(value: number, places: number) {
  const factor = 10 ** places;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-8;
}
