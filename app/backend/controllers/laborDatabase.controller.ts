import { Request, Response } from "express";
import { z } from "zod";
import { LaborDatabaseService } from "../../modules/labor-database/service";
import { requireOrgId, requirePermissions } from "../requestContext";

const service = new LaborDatabaseService();
const maxHourlyRate = 99_999_999.99;

const createSchema = z.object({
  orgId: z.string().uuid().optional(),
  trade: z.string().trim().min(1).max(120),
  baseHourlyRate: z.preprocess(
    rejectBlankNumericInput,
    z.coerce.number().finite().nonnegative().max(maxHourlyRate).refine((value) => hasAtMostDecimalPlaces(value, 2), {
      message: "Number must fit the database precision",
    })
  ),
  burdenPct: z.preprocess(rejectBlankNumericInput, z.coerce.number().finite().min(0).max(100).optional()),
  regionId: z.string().uuid().optional(),
}).strict();

export const laborDatabaseController = {
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
    res.json(await service.update(req.params.id, createSchema.partial().parse(req.body), requireOrgId(req)));
  },
  async remove(req: Request, res: Response) {
    requirePermissions(req, ["costbook.manage"]);
    await service.delete(req.params.id, requireOrgId(req));
    res.status(204).send();
  },
  async calculate(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const schema = z.object({ laborRateId: z.string().uuid(), quantity: z.coerce.number().positive(), productionRate: z.coerce.number().positive() });
    res.json(await service.calculateLaborCost(schema.parse(req.body), requireOrgId(req)));
  },
};

function rejectBlankNumericInput(value: unknown) {
  if (value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function hasAtMostDecimalPlaces(value: number, places: number) {
  const factor = 10 ** places;
  return Math.abs(value * factor - Math.trunc(value * factor)) < Number.EPSILON;
}
