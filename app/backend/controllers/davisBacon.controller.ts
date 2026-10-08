import { Request, Response } from "express";
import { z } from "zod";
import { requirePermissions } from "../requestContext";
import {
  listCountyRates,
  listDeterminations,
  listRatesForDetermination,
} from "../../modules/costbook/davisBaconService";

const determinationsQuerySchema = z.object({
  state: z.string().trim().min(1).max(4).optional(),
  county: z.string().trim().min(1).max(80).optional(),
  activeOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

const ratesQuerySchema = z.object({
  wdNumber: z.string().trim().min(1).max(32),
});

const countyRatesQuerySchema = z.object({
  state: z.string().trim().min(1).max(4),
  county: z.string().trim().min(1).max(80),
});

export const davisBaconController = {
  async listDeterminations(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const query = determinationsQuerySchema.parse(req.query);
    res.json(await listDeterminations(auth.orgId, query));
  },

  async listRates(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const query = ratesQuerySchema.parse(req.query);
    res.json(await listRatesForDetermination(auth.orgId, query.wdNumber));
  },

  async countyRates(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const query = countyRatesQuerySchema.parse(req.query);
    res.json(await listCountyRates(auth.orgId, query.state, query.county));
  },
};
