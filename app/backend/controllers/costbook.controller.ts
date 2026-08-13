import { Request, Response } from "express";
import { z } from "zod";
import { CostbookService } from "../../modules/costbook";
import { requireAuthContext, requirePermissions } from "../requestContext";

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

const listQuerySchema = z.object({ divisionId: z.string().uuid().optional(), categoryId: z.string().uuid().optional() });

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
  async listLaborRates(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    res.json(await service.listLaborRates(auth));
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
    res.json(await service.listDivisions(auth));
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
    res.json(await service.updateDivision(auth, id, divisionUpdateSchema.parse(req.body)));
  },
  async removeDivision(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    const { id } = idParamSchema.parse(req.params);
    await service.deactivateDivision(auth, id);
    res.status(204).send();
  },
  async listCategories(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const { divisionId } = listQuerySchema.parse(req.query);
    res.json(await service.listCategories(auth, divisionId));
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
    res.json(await service.updateCategory(auth, id, categoryUpdateSchema.parse(req.body)));
  },
  async removeCategory(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    const { id } = idParamSchema.parse(req.params);
    await service.deactivateCategory(auth, id);
    res.status(204).send();
  },
  async listSubcategories(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const { categoryId } = listQuerySchema.parse(req.query);
    res.json(await service.listSubcategories(auth, categoryId));
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
    res.json(await service.updateSubcategory(auth, id, subcategoryUpdateSchema.parse(req.body)));
  },
  async removeSubcategory(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    const { id } = idParamSchema.parse(req.params);
    await service.deactivateSubcategory(auth, id);
    res.status(204).send();
  },
};

function rejectBlankNumericInput(value: unknown) {
  if (value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function hasAtMostDecimalPlaces(value: number, places: number) {
  const factor = 10 ** places;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-8;
}
