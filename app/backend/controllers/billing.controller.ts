import { Request, Response } from "express";
import { z } from "zod";
import { requireAuthContext, requireOrgAdmin, requireOrgId, requirePermissions } from "../requestContext";
import { BillingService } from "../../modules/billing/service";
import { billingIntervals, billingPlans } from "../../modules/billing/types";
import { verifyStripeWebhook } from "../../modules/billing/stripeRest";
import { ApiError } from "../middleware/errorHandler";

const service = new BillingService();
const checkoutSchema = z.object({
  plan: z.enum(billingPlans),
  billingInterval: z.enum(billingIntervals),
}).strict();

export const billingController = {
  async summary(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    res.json(await service.getSummary(requireOrgId(req)));
  },

  async checkout(req: Request, res: Response) {
    requireOrgAdmin(req);
    const input = checkoutSchema.parse(req.body);
    res.status(201).json(await service.createCheckout(requireAuthContext(req), input.plan, input.billingInterval));
  },

  async portal(req: Request, res: Response) {
    requireOrgAdmin(req);
    res.status(201).json(await service.createPortal(requireOrgId(req)));
  },

  async webhook(req: Request, res: Response) {
    if (!Buffer.isBuffer(req.body)) throw new ApiError(400, "Stripe webhook requires a raw request body");
    const event = verifyStripeWebhook(req.body, req.header("stripe-signature") ?? undefined);
    const result = await service.processWebhook(event);
    res.json({ received: true, duplicate: result.duplicate });
  },
};
