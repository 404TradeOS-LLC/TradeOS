import { Request, Response } from "express";
import { z } from "zod";
import { requireAuthContext, requireOrgId } from "../requestContext";
import { JobExpensesService } from "../../modules/expenses/service";
import { expenseCategories, expensePaymentResponsibilities } from "../../modules/expenses/types";

const service = new JobExpensesService();

// Local YYYY-MM-DD calendar date is stored at UTC midnight, not device-local.
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "incurredOn must be a YYYY-MM-DD date").refine(
  (value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  },
  { message: "incurredOn must be a real calendar date" },
);

const amount = z.number().int().positive().max(2147483647);
const payer = z.enum(expensePaymentResponsibilities);
const category = z.enum(expenseCategories);
const createExpenseSchema = z.object({
  amountCents: amount,
  currency: z.literal("USD").optional(),
  description: z.string().trim().max(2000).optional(),
  idempotencyKey: z.guid().optional(),
  category,
  paymentResponsibility: payer.optional(),
  vendor: z.string().trim().max(200).optional(),
  receiptNote: z.string().trim().max(2000).optional(),
  incurredOn: dateOnly,
}).strict();
const updateExpenseSchema = z.object({
  amountCents: amount.optional(),
  description: z.string().trim().max(2000).optional(),
  category: category.optional(),
  paymentResponsibility: payer.optional(),
  vendor: z.string().trim().max(200).optional(),
  receiptNote: z.string().trim().max(2000).optional(),
  incurredOn: dateOnly.optional(),
}).strict();

const receiptSchema = z.object({
  receiptStoragePath: z.string().min(1).max(500),
  receiptFileName: z.string().trim().min(1).max(200),
  receiptContentType: z.enum(["image/png", "image/jpeg", "application/pdf"]),
  receiptSizeBytes: z.number().int().min(1).max(6 * 1024 * 1024),
}).strict();

function toIncurredDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export const expensesController = {
  async list(req: Request, res: Response) {
    res.json(await service.list(req.params.jobId, requireOrgId(req)));
  },
  async getById(req: Request, res: Response) {
    res.json(await service.getById(req.params.expenseId, requireOrgId(req), req.params.jobId));
  },
  async getSummary(req: Request, res: Response) {
    res.json(await service.getJobCostSummary(req.params.jobId, requireOrgId(req)));
  },
  async getAuditEvents(req: Request, res: Response) {
    res.json(await service.listAuditEvents(req.params.expenseId, requireOrgId(req), req.params.jobId));
  },
  async create(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = createExpenseSchema.parse(req.body);
    res.status(201).json(await service.create({
      orgId: requireOrgId(req), jobId: req.params.jobId, actorUserId: auth.userId,
      amountCents: body.amountCents, currency: body.currency,
      description: body.description, idempotencyKey: body.idempotencyKey,
      category: body.category, paymentResponsibility: body.paymentResponsibility,
      vendor: body.vendor, receiptNote: body.receiptNote,
      incurredOn: toIncurredDate(body.incurredOn),
    }));
  },
  async update(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = updateExpenseSchema.parse(req.body);
    res.json(await service.update({
      id: req.params.expenseId, orgId: requireOrgId(req), jobId: req.params.jobId,
      actorUserId: auth.userId, amountCents: body.amountCents,
      description: body.description, category: body.category,
      paymentResponsibility: body.paymentResponsibility, vendor: body.vendor,
      receiptNote: body.receiptNote,
      incurredOn: body.incurredOn ? toIncurredDate(body.incurredOn) : undefined,
    }));
  },
  async attachReceipt(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = receiptSchema.parse(req.body);
    res.json(await service.attachReceipt({
      id: req.params.expenseId, jobId: req.params.jobId, orgId: requireOrgId(req),
      actorUserId: auth.userId, ...body,
    }));
  },
  async remove(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = z.object({ reason: z.string().trim().max(500).optional() }).strict().parse(req.body ?? {});
    await service.remove(req.params.expenseId, requireOrgId(req), req.params.jobId, auth.userId, body.reason);
    res.status(204).send();
  },
};
