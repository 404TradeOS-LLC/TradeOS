import { Request, Response } from "express";
import { z } from "zod";
import { OnboardingService } from "../../modules/onboarding/service";
import { requireOrgId, requirePermissions } from "../requestContext";

const service = new OnboardingService();

const saveProgressSchema = z.object({
  currentStep: z.number().int().min(1).max(2).optional(),
  workTypes: z.array(z.string()).max(12).optional(),
  scopeText: z.string().max(10_000).nullable().optional(),
  laborRateCents: z.number().int().min(100).max(50_000).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
});

const completeSchema = z.object({
  workTypes: z.array(z.string()).min(1).max(12),
  scopeText: z.string().min(10).max(10_000),
  laborRateCents: z.number().int().min(100).max(50_000).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
});

export const onboardingController = {
  async getState(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    const state = await service.getState(requireOrgId(req));
    res.status(200).json({ state });
  },

  async saveProgress(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const body = saveProgressSchema.parse(req.body);
    res.status(200).json({ state: await service.saveProgress(requireOrgId(req), body) });
  },

  async skip(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    res.status(200).json({ state: await service.skip(requireOrgId(req)) });
  },

  async complete(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const body = completeSchema.parse(req.body);
    res.status(200).json({ state: await service.complete(requireOrgId(req), body) });
  },
};
