import { Request, Response } from "express";
import { PaymentLedgerService } from "../../modules/payments/service";
import { requireOrgId, requirePermissions } from "../requestContext";

const service = new PaymentLedgerService();

export const paymentsLedgerController = {
  async currentWeek(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    res.json(await service.listCurrentWeek(requireOrgId(req)));
  },
};
