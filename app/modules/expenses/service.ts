import { PrismaClient } from "@prisma/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { prisma } from "../../db/client";
import {
  CreateJobExpenseInput,
  ExpenseCategory,
  ExpensePaymentResponsibility,
  JobCostSummaryDTO,
  JobExpenseDTO,
  UpdateJobExpenseInput,
  expenseCategories,
  expensePaymentResponsibilities,
} from "./types";

type JobExpenseRow = {
  id: string;
  jobId: string;
  orgId: string;
  amountCents: number;
  paymentResponsibility: string;
  category: string;
  vendor: string;
  receiptNote: string;
  incurredOn: Date;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

const CATEGORY_SET = new Set<string>(expenseCategories);
const PAYMENT_RESPONSIBILITY_SET = new Set<string>(expensePaymentResponsibilities);

function toDTO(row: JobExpenseRow): JobExpenseDTO {
  return {
    id: row.id,
    jobId: row.jobId,
    orgId: row.orgId,
    amountCents: row.amountCents,
    paymentResponsibility: (row.paymentResponsibility ?? "contractor") as ExpensePaymentResponsibility,
    category: row.category as ExpenseCategory,
    vendor: row.vendor,
    receiptNote: row.receiptNote,
    incurredOn: row.incurredOn.toISOString().slice(0, 10),
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertValidAmountCents(amountCents: unknown): number {
  if (typeof amountCents !== "number" || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new ApiError(400, "amountCents must be a positive integer number of cents");
  }
  return amountCents;
}

function assertValidCategory(category: unknown): ExpenseCategory {
  if (typeof category !== "string" || !CATEGORY_SET.has(category)) {
    throw new ApiError(400, `category must be one of: ${expenseCategories.join(", ")}`);
  }
  return category as ExpenseCategory;
}

function assertValidPaymentResponsibility(value: unknown): ExpensePaymentResponsibility {
  if (typeof value !== "string" || !PAYMENT_RESPONSIBILITY_SET.has(value)) {
    throw new ApiError(400, "paymentResponsibility must be contractor or customer");
  }
  return value as ExpensePaymentResponsibility;
}

function normalizeText(value: string | undefined, maxLength: number, field: string): string {
  const trimmed = (value ?? "").trim();
  if (trimmed.length > maxLength) {
    throw new ApiError(400, `${field} must be ${maxLength} characters or fewer`);
  }
  return trimmed;
}

function assertValidDate(value: unknown, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ApiError(400, `${field} must be a valid date`);
  }
  return value;
}

/** Cents-exact decimal-to-cents conversion for estimate totals (Decimal 14,2). */
export function decimalToCents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

export class JobExpensesService {
  constructor(private readonly db: PrismaClient = prisma) {}

  /**
   * Tenant scope is enforced through the job: the job must belong to the
   * caller's org, otherwise this is a 404 (never a cross-org leak). This
   * mirrors InvoicesService.create's project lookup discipline.
   */
  private async assertJobInOrg(jobId: string, orgId: string): Promise<{ id: string; projectId: string }> {
    const job = await this.db.job.findFirst({ where: { id: jobId, orgId } });
    if (!job) throw new ApiError(404, `Job ${jobId} not found`);
    return { id: job.id, projectId: job.projectId };
  }

  private async findExpenseOrThrow(id: string, orgId: string): Promise<JobExpenseRow> {
    const row = await this.db.jobExpense.findFirst({ where: { id, orgId } });
    if (!row) throw new ApiError(404, `Job expense ${id} not found`);
    return row as JobExpenseRow;
  }

  async list(jobId: string, orgId: string): Promise<JobExpenseDTO[]> {
    await this.assertJobInOrg(jobId, orgId);
    const rows = await this.db.jobExpense.findMany({
      where: { jobId, orgId },
      orderBy: [{ incurredOn: "desc" }, { createdAt: "desc" }],
    });
    return (rows as JobExpenseRow[]).map(toDTO);
  }

  async getById(id: string, orgId: string): Promise<JobExpenseDTO> {
    return toDTO(await this.findExpenseOrThrow(id, orgId));
  }

  async create(input: CreateJobExpenseInput): Promise<JobExpenseDTO> {
    const amountCents = assertValidAmountCents(input.amountCents);
    const category = assertValidCategory(input.category);
    const paymentResponsibility = assertValidPaymentResponsibility(input.paymentResponsibility ?? "contractor");
    const vendor = normalizeText(input.vendor, 200, "vendor");
    const receiptNote = normalizeText(input.receiptNote, 2000, "receiptNote");
    const incurredOn = assertValidDate(input.incurredOn, "incurredOn");
    const job = await this.assertJobInOrg(input.jobId, input.orgId);
    const row = await this.db.jobExpense.create({
      data: {
        orgId: input.orgId,
        jobId: job.id,
        amountCents,
        paymentResponsibility,
        category,
        vendor,
        receiptNote,
        incurredOn,
        createdById: input.actorUserId,
      },
    });
    return toDTO(row as JobExpenseRow);
  }

  async update(input: UpdateJobExpenseInput): Promise<JobExpenseDTO> {
    await this.findExpenseOrThrow(input.id, input.orgId);
    const data: {
      amountCents?: number;
      paymentResponsibility?: ExpensePaymentResponsibility;
      category?: ExpenseCategory;
      vendor?: string;
      receiptNote?: string;
      incurredOn?: Date;
    } = {};
    if (input.amountCents !== undefined) data.amountCents = assertValidAmountCents(input.amountCents);
    if (input.category !== undefined) data.category = assertValidCategory(input.category);
    if (input.paymentResponsibility !== undefined) data.paymentResponsibility = assertValidPaymentResponsibility(input.paymentResponsibility);
    if (input.vendor !== undefined) data.vendor = normalizeText(input.vendor, 200, "vendor");
    if (input.receiptNote !== undefined) data.receiptNote = normalizeText(input.receiptNote, 2000, "receiptNote");
    if (input.incurredOn !== undefined) data.incurredOn = assertValidDate(input.incurredOn, "incurredOn");
    const row = await this.db.jobExpense.update({ where: { id: input.id }, data });
    return toDTO(row as JobExpenseRow);
  }

  async remove(id: string, orgId: string): Promise<void> {
    await this.findExpenseOrThrow(id, orgId);
    await this.db.jobExpense.delete({ where: { id } });
  }

  /**
   * Actual-vs-estimate rollup for one job. Actuals are summed as integer
   * cents, so the total is exact. The estimate side is the project's latest
   * estimate by version (estimates are versioned per project); when the
   * project has no estimate, estimatedCents/varianceCents are null rather
   * than a fabricated zero.
   */
  async getJobCostSummary(jobId: string, orgId: string): Promise<JobCostSummaryDTO> {
    const job = await this.assertJobInOrg(jobId, orgId);
    const [rows, latestEstimate] = await Promise.all([
      this.db.jobExpense.findMany({ where: { jobId, orgId } }),
      this.db.estimate.findFirst({
        where: { projectId: job.projectId },
        orderBy: [{ version: "desc" }],
      }),
    ]);
    const byCategoryCents: Record<string, number> = {};
    let actualCents = 0;
    let customerPaidCents = 0;
    for (const row of rows as JobExpenseRow[]) {
      // Existing records predate this field and are contractor-paid by default.
      if (row.paymentResponsibility === "customer") {
        customerPaidCents += row.amountCents;
        continue;
      }
      actualCents += row.amountCents;
      byCategoryCents[row.category] = (byCategoryCents[row.category] ?? 0) + row.amountCents;
    }
    const estimatedCents = latestEstimate ? decimalToCents(latestEstimate.totalPrice) : null;
    return {
      jobId,
      projectId: job.projectId,
      expenseCount: rows.length,
      actualCents,
      customerPaidCents,
      byCategoryCents,
      estimatedCents,
      estimateId: latestEstimate ? latestEstimate.id : null,
      varianceCents: estimatedCents === null ? null : estimatedCents - actualCents,
    };
  }
}
