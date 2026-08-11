import { Request, Response } from "express";
import { CostbookService } from "../../modules/costbook";
import { requireAuthContext, requirePermissions } from "../requestContext";

const service = new CostbookService();

export const costbookController = {
  async workspace(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    res.json(await service.getWorkspace(requireAuthContext(req)));
  },
};
