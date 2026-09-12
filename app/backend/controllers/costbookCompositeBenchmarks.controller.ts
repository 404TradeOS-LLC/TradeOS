import { Request, Response } from "express";
import { z } from "zod";
import { requirePermissions } from "../requestContext";
import { CompositePriceBenchmarkService } from "../../modules/costbook/compositePriceBenchmarkService";

const service = new CompositePriceBenchmarkService();

const bulkImportSchema = z.object({
  rows: z.array(z.unknown()).min(1).max(1000),
}).strict();

export const costbookCompositeBenchmarksController = {
  async importRows(req: Request, res: Response) {
    // Composite benchmark writes are intentionally owner/admin only. The org
    // is derived from the authenticated request context; no caller-supplied
    // organization id is accepted anywhere in this contract.
    const auth = requirePermissions(req, ["costbook.manage"]);
    const { rows } = bulkImportSchema.parse(req.body);
    res.status(200).json(await service.importRows(auth, rows));
  },
};
