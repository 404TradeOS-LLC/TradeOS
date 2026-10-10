import { Request, Response } from "express";
import { z } from "zod";
import { SupplierIntegrationService } from "../../modules/supplier-integration/service";
import { probeAbcSandboxPricing } from "../../modules/supplier-integration/abcPricingProbe";
import { ApiError } from "../middleware/errorHandler";
import { requireOrgId, requirePermissions } from "../requestContext";
import { catalogQuerySchema, parseCatalogQuery } from "../../modules/shared/catalog-query";

const service = new SupplierIntegrationService();
const idSchema = z.string().uuid();

const listQuerySchema = catalogQuerySchema.extend({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  supplierId: z.string().uuid().optional(),
  materialId: z.string().uuid().optional(),
}).strict();

const enqueueSchema = z.object({
  supplierId: z.string().uuid(),
  materialId: z.string().uuid(),
  proposedUnitCost: z.coerce.number().finite().nonnegative().max(99_999_999.9999),
  source: z.string().trim().min(1).max(64).optional(),
}).strict();

const abcProbeSchema = z.object({
  productKey: z.literal("ABC-654210"),
}).strict();

export const supplierIntegrationController = {
  async probeAbcSandbox(req: Request, res: Response) {
    const actor = requirePermissions(req, ["costbook.manage"]);
    if (!["owner", "admin"].includes(actor.role)) {
      throw new ApiError(403, "Only a workspace owner/admin can test ABC sandbox pricing");
    }
    const { productKey } = abcProbeSchema.parse(req.body);
    res.json(await probeAbcSandboxPricing(requireOrgId(req), productKey));
  },
  async listQueue(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const parsed = listQuerySchema.parse(req.query);
    const query = parseCatalogQuery(
      { limit: parsed.limit, cursor: parsed.cursor, q: parsed.q, sort: parsed.sort, order: parsed.order ?? "desc" },
      { defaultSort: "createdAt", allowedSorts: ["createdAt", "status"], filters: { status: parsed.status, supplierId: parsed.supplierId, materialId: parsed.materialId } }
    );
    res.json(await service.listQueuePage(requireOrgId(req), query));
  },
  async enqueue(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const orgId = requireOrgId(req);
    res.status(201).json(await service.enqueue({ ...enqueueSchema.parse(req.body), orgId }));
  },
  async approve(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    res.json(await service.approve(idSchema.parse(req.params.id), requireOrgId(req), auth));
  },
  async reject(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    res.json(await service.reject(idSchema.parse(req.params.id), requireOrgId(req), auth));
  },
};
