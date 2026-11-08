import { Request, Response } from "express";
import { z } from "zod";
import { requirePermissions } from "../requestContext";
import { listCodeReferences } from "../../modules/costbook/codes/registry";

const querySchema = z.object({
  state: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()),
  county: z.string().trim().min(1).max(80).optional(),
  q: z.string().trim().max(120).optional(),
  topic: z.enum(["signage", "permits", "electrical", "structural", "right-of-way"]).optional(),
}).strict();

export const costbookCodesController = {
  list(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const query = querySchema.parse(req.query);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(listCodeReferences(query));
  },
};
