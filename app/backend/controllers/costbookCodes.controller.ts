import { Request, Response } from "express";
import { z } from "zod";
import { requirePermissions } from "../requestContext";
import { listCodeReferencesFromDb } from "../../modules/costbook/codes/service";

const querySchema = z.object({
  state: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()),
  county: z.string().trim().min(1).max(80).optional(),
  q: z.string().trim().max(120).optional(),
  topic: z.enum(["signage", "permits", "electrical", "structural", "right-of-way"]).optional(),
}).strict();

export const costbookCodesController = {
  async list(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const query = querySchema.parse(req.query);
    res.setHeader("Cache-Control", "private, no-store");
    // DB-backed since #946 TODO 2: reads codes_source (seeded from the
    // #945 pilot registry) inside the request-scoped RLS session. The
    // in-code registry is the seed source only, not a runtime source.
    res.json(await listCodeReferencesFromDb(query));
  },
};
