import { Request, Response } from "express";
import { z } from "zod";
import { KnowledgeRuntimeService } from "../../modules/knowledge-runtime/service";

const service = new KnowledgeRuntimeService();

const searchSchema = z.object({
  q: z.string().optional().default(""),
  type: z.enum(["assembly", "costItem", "all"]).optional().default("all"),
  trade: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(25).optional().default(10),
});

const matchScopeSchema = z.object({
  scopeText: z.string().trim().min(1, "scopeText is required"),
  limit: z.coerce.number().int().min(1).max(10).optional().default(5),
});

export const knowledgeRuntimeController = {
  async stats(_req: Request, res: Response) {
    res.json(service.getStats());
  },

  async trades(_req: Request, res: Response) {
    res.json(service.listTrades());
  },

  async search(req: Request, res: Response) {
    const { q, type, trade, limit } = searchSchema.parse(req.query);
    res.json(service.search({ query: q, type, trade, limit }));
  },

  async searchAssemblies(req: Request, res: Response) {
    const { q, trade, limit } = searchSchema.parse({ ...req.query, type: "assembly" });
    res.json(service.searchAssemblies(q, limit, trade));
  },

  async searchCostItems(req: Request, res: Response) {
    const { q, trade, limit } = searchSchema.parse({ ...req.query, type: "costItem" });
    res.json(service.searchCostItems(q, limit, trade));
  },

  async match(req: Request, res: Response) {
    const { scopeText, limit } = matchScopeSchema.parse(req.body ?? {});
    res.json(service.matchScope(scopeText, limit));
  },

  async matchScope(req: Request, res: Response) {
    const { scopeText, limit } = matchScopeSchema.parse(req.body ?? {});
    res.json(service.matchScope(scopeText, limit));
  },
};
