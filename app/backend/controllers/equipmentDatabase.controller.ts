import { Request, Response } from "express";
import { z } from "zod";
import { EquipmentDatabaseService } from "../../modules/equipment-database/service";
import { requireOrgId, requirePermissions } from "../requestContext";

const service = new EquipmentDatabaseService();

const createSchema = z.object({
  orgId: z.string().uuid().optional(),
  name: z.string().min(1),
  ownershipCostPerHour: z.number().min(0).optional(),
  operatingCostPerHour: z.number().min(0).optional(),
  dailyRate: z.number().min(0).optional(),
});

export const equipmentDatabaseController = {
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
    const schema = z.object({
      equipmentId: z.string().uuid(),
      hours: z.coerce.number().positive(),
      billableHoursPerDay: z.coerce.number().positive().optional(),
      useDailyRate: z.boolean().optional(),
    });
    res.json(await service.calculateEquipmentCost(schema.parse(req.body), requireOrgId(req)));
  },
};
