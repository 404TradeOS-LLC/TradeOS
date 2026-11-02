import { Request, Response } from "express";
import { z } from "zod";
import { requireAuthContext, requireOrgId } from "../requestContext";
import { JobExpensesService } from "../../modules/expenses/service";
import { expenseCategories } from "../../modules/expenses/types";

const service = new JobExpensesService();

// incurredOn is a calendar date (YYYY-MM-DD), matching the date input the
// jobsite form sends. It is stored at UTC midnight so the date a tech
// records is the date that lists, regardless of device timezone.
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "incurredOn must be a YYYY-MM-DD date").refine(
  (value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  },
  { message: "incurredOn must be a real calendar date" },
);

const createExpenseSchema = z.object({
  amountCents: z.number().int().positive(),
  category: z.enum(expenseCategories),
  vendor: z.string().trim().max(200).optional(),
  receiptNote: z.string().trim().max(2000).optional(),
  incurredOn: dateOnly,
});

const updateExpenseSchema = z.object({
  amountCents: z.number().int().positive().optional(),
  category: z.enum(expenseCategories).optional(),
  vendor: z.string().trim().max(200).optional(),
  receiptNote: z.string().trim().max(2000).optional(),
  incurredOn: dateOnly.optional(),
});

function toIncurredDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export const expensesController = {
  async list(req: Request, res: Response) {
    res.json(await service.list(req.params.jobId, requireOrgId(req)));
  },

  async getById(req: Request, res: Response) {
    res.json(await service.getById(req.params.expenseId, requireOrgId(req)));
  },

  async getSummary(req: Request, res: Response) {
    res.json(await service.getJobCostSummary(req.params.jobId, requireOrgId(req)));
  },

  async create(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = createExpenseSchema.parse(req.body);
    res.status(201).json(
      await service.create({
        orgId: requireOrgId(req),
        jobId: req.params.jobId,
        actorUserId: auth.userId,
        amountCents: body.amountCents,
        category: body.category,
        vendor: body.vendor,
        receiptNote: body.receiptNote,
        incurredOn: toIncurredDate(body.incurredOn),
      }),
    );
  },

  async update(req: Request, res: Response) {
    const body = updateExpenseSchema.parse(req.body);
    res.json(
      await service.update({
        id: req.params.expenseId,
        orgId: requireOrgId(req),
        amountCents: body.amountCents,
        category: body.category,
        vendor: body.vendor,
        receiptNote: body.receiptNote,
        incurredOn: body.incurredOn ? toIncurredDate(body.incurredOn) : undefined,
      }),
    );
  },

  async remove(req: Request, res: Response) {
    await service.remove(req.params.expenseId, requireOrgId(req));
    res.status(204).send();
  },
};
