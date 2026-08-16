import { Request, Response } from "express";
import { z } from "zod";
import { CostbookPricingService } from "../../modules/costbook/pricing";
import { requireOrgId, requirePermissions } from "../requestContext";

const service = new CostbookPricingService();
const money = z.coerce.number().finite().nonnegative().max(999_999_999);
const percent = z.coerce.number().finite().nonnegative().max(10_000);

const previewSchema = z.object({
  jobCost: money,
  directOverhead: money.optional(),
  overheadPct: percent.optional(),
  mode: z.enum(["markup", "targetMargin"]),
  markupPct: percent.optional(),
  targetMarginPct: z.coerce.number().finite().min(0).lt(100).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.mode === "markup" && value.markupPct === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["markupPct"], message: "markupPct is required for markup mode" });
  }
  if (value.mode === "targetMargin" && value.targetMarginPct === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetMarginPct"], message: "targetMarginPct is required for target-margin mode" });
  }
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  materialId: z.string().uuid().optional(),
  estimateId: z.string().uuid().optional(),
  sourceType: z.enum(["cost_item", "assembly"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "to must be at or after from" });
  }
});

export const costbookPricingController = {
  async preview(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    res.json(service.preview(previewSchema.parse(req.body)));
  },
  async history(req: Request, res: Response) {
    requirePermissions(req, ["costbook.manage"]);
    const filter = historyQuerySchema.parse(req.query);
    res.json(await service.listHistory(requireOrgId(req), filter));
  },
};
