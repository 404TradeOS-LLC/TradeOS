import { Request, Response } from "express";
import { z } from "zod";
import { basePrisma } from "../../db/client";
import { runWithDatabaseSession } from "../../db/requestSession";
import { InvoicesService } from "../../modules/invoices/service";
import { sanitizeDownloadFilename } from "../../modules/documents/format";
import { requireAuthContext, requireOrgId, requirePermissions } from "../requestContext";
import { commaSeparatedEnum, strictOptionalBoolean } from "../queryParams";
import { invoiceStatuses } from "../../domain";

const service = new InvoicesService();

const listQueueQuerySchema = z.object({
  status: commaSeparatedEnum(z.enum(invoiceStatuses)),
  sent: strictOptionalBoolean,
  overdue: strictOptionalBoolean,
  partiallyPaid: strictOptionalBoolean,
  unpaid: strictOptionalBoolean,
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional(),
});

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitOfMeasure: z.string().min(1),
  unitPrice: z.coerce.number().nonnegative(),
});

const createSchema = z.object({
  projectId: z.guid(),
  estimateId: z.guid().optional(),
  proposalId: z.guid().optional(),
  type: z.enum(["full", "progress"]).optional(),
  percentComplete: z.coerce.number().min(0).max(100).optional(),
  dueDate: z.string().optional(),
  lineItems: z.array(lineItemSchema).optional(),
});

const updateSchema = z.object({
  lineItems: z.array(lineItemSchema).min(1).optional(),
  dueDate: z.string().nullable().optional(),
});

export const invoicesController = {
  async listByProject(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    res.json(await service.listByProject(req.params.projectId, requireOrgId(req)));
  },
  async listOrganizationQueue(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    const query = listQueueQuerySchema.parse(req.query);
    res.json(
      await service.listOrganizationQueue({
        orgId: requireOrgId(req),
        statuses: query.status,
        sent: query.sent,
        overdue: query.overdue,
        partiallyPaid: query.partiallyPaid,
        unpaid: query.unpaid,
        updatedAfter: query.updatedAfter,
        updatedBefore: query.updatedBefore,
        limit: query.limit,
        cursor: query.cursor,
      })
    );
  },
  async getById(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    res.json(await service.getById(req.params.id, requireOrgId(req)));
  },
  async create(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const input = { ...createSchema.parse(req.body), orgId: requireOrgId(req), actorUserId: auth.userId, actorRole: auth.role };
    res.status(201).json(await service.create(input));
  },
  async createRecoverable(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const input = { ...createSchema.parse(req.body), orgId: requireOrgId(req), actorUserId: auth.userId, actorRole: auth.role };
    const key = z.guid().parse(req.headers["idempotency-key"]).toLowerCase();
    const create = () => runWithDatabaseSession(basePrisma, auth, () => service.createWithIdempotency(input, key));
    const { invoice, replayed } = await create().catch((error: unknown) => {
      // A fresh tenant-scoped snapshot can see the concurrent winner.
      if (error && typeof error === "object" && "code" in error && (error.code === "P2002" || error.code === "P2034")) {
        return create();
      }
      throw error;
    });
    res.setHeader("Idempotency-Replayed", String(replayed));
    res.status(replayed ? 200 : 201).json(invoice);
  },
  async update(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = updateSchema.parse(req.body);
    res.json(
      await service.update({ id: req.params.id, orgId: requireOrgId(req), actorUserId: auth.userId, actorRole: auth.role, ...body })
    );
  },
  async getPdf(req: Request, res: Response) {
    requirePermissions(req, ["billing.read"]);
    const doc = await service.getPdf(req.params.id, requireOrgId(req));
    res.setHeader("Content-Type", doc.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${sanitizeDownloadFilename(doc.filename)}"`);
    res.send(doc.buffer);
  },
  async send(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    res.json(await service.send(req.params.id, requireOrgId(req), auth.userId, auth.role));
  },
  async markPaid(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    res.json(await service.markPaid(req.params.id, requireOrgId(req), auth.userId, auth.role));
  },
  async void(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    res.json(await service.void(req.params.id, requireOrgId(req), auth.userId, auth.role));
  },
};
