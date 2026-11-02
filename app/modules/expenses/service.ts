import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { prisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import {
  AttachJobExpenseReceiptInput, CreateJobExpenseInput, ExpenseCategory,
  ExpensePaymentResponsibility, JobCostSummaryDTO, JobExpenseDTO,
  JobExpenseEventDTO, ReceiptContentType, UpdateJobExpenseInput,
  expenseCategories, expensePaymentResponsibilities,
} from "./types";

type JobExpenseRow = {
  id: string; orgId: string; jobId: string; amountCents: number;
  currency?: string; description?: string; idempotencyKey?: string | null;
  category: string; paymentResponsibility?: string; vendor: string;
  receiptNote: string; receiptStoragePath?: string | null;
  receiptFileName?: string | null; receiptContentType?: string | null;
  receiptSizeBytes?: number | null; incurredOn: Date; createdById: string;
  createdAt: Date; updatedAt: Date; voidedAt?: Date | null;
  voidedById?: string | null; voidReason?: string;
};

const CATEGORY_SET = new Set<string>(expenseCategories);
const PAYMENT_RESPONSIBILITY_SET = new Set<string>(expensePaymentResponsibilities);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECEIPT_FILE = /^receipt-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpg|pdf)$/i;
const RECEIPT_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "application/pdf": "pdf" };
const MAX_RECEIPT_BYTES = 6 * 1024 * 1024;

function toDTO(row: JobExpenseRow): JobExpenseDTO {
  return {
    id: row.id, orgId: row.orgId, jobId: row.jobId,
    amountCents: row.amountCents, currency: "USD",
    description: row.description ?? "",
    paymentResponsibility: (row.paymentResponsibility ?? "contractor") as ExpensePaymentResponsibility,
    category: row.category as ExpenseCategory,
    vendor: row.vendor, receiptNote: row.receiptNote,
    receiptStoragePath: row.receiptStoragePath ?? null,
    receiptFileName: row.receiptFileName ?? null,
    receiptContentType: (row.receiptContentType ?? null) as ReceiptContentType | null,
    receiptSizeBytes: row.receiptSizeBytes ?? null,
    incurredOn: row.incurredOn.toISOString().slice(0, 10),
    createdById: row.createdById, createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidedById: row.voidedById ?? null,
    voidReason: row.voidReason ?? "",
  };
}

function assertValidAmountCents(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > 2147483647) {
    throw new ApiError(400, "amountCents must be a positive integer within the database cents limit");
  }
  return value;
}

function assertValidCategory(value: unknown): ExpenseCategory {
  if (typeof value !== "string" || !CATEGORY_SET.has(value)) {
    throw new ApiError(400, `category must be one of: ${expenseCategories.join(", ")}`);
  }
  return value as ExpenseCategory;
}

function assertValidPaymentResponsibility(value: unknown): ExpensePaymentResponsibility {
  if (typeof value !== "string" || !PAYMENT_RESPONSIBILITY_SET.has(value)) {
    throw new ApiError(400, "paymentResponsibility must be contractor or customer");
  }
  return value as ExpensePaymentResponsibility;
}

function normalizeText(value: string | undefined, maxLength: number, field: string): string {
  const trimmed = (value ?? "").trim();
  if (trimmed.length > maxLength) throw new ApiError(400, `${field} must be ${maxLength} characters or fewer`);
  return trimmed;
}

function assertValidDate(value: unknown, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new ApiError(400, `${field} must be a valid date`);
  return value;
}

function assertSubmissionKey(value: string | undefined): string | null {
  if (value === undefined) return null;
  if (!UUID.test(value)) throw new ApiError(400, "idempotencyKey must be a UUID");
  return value.toLowerCase();
}

function assertLive(row: JobExpenseRow): void {
  if (row.voidedAt) throw new ApiError(409, "Voided expenses cannot be changed or linked to receipts");
}

function auditSnapshot(row: JobExpenseRow) {
  return {
    amountCents: row.amountCents, currency: row.currency ?? "USD",
    description: row.description ?? "", category: row.category,
    paymentResponsibility: row.paymentResponsibility ?? "contractor",
    vendor: row.vendor, receiptNote: row.receiptNote,
    incurredOn: row.incurredOn.toISOString().slice(0, 10),
    receiptStoragePath: row.receiptStoragePath ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidReason: row.voidReason ?? "",
  };
}

function assertSameSubmission(existing: JobExpenseRow, input: {
  amountCents: number; category: ExpenseCategory; paymentResponsibility: ExpensePaymentResponsibility;
  vendor: string; receiptNote: string; description: string; incurredOn: Date;
  actorUserId: string;
}): JobExpenseDTO {
  if (existing.voidedAt ||
      existing.amountCents !== input.amountCents || existing.category !== input.category ||
      (existing.paymentResponsibility ?? "contractor") !== input.paymentResponsibility ||
      existing.vendor !== input.vendor || existing.receiptNote !== input.receiptNote ||
      (existing.description ?? "") !== input.description ||
      existing.incurredOn.getTime() !== input.incurredOn.getTime() ||
      existing.createdById !== input.actorUserId) {
    throw new ApiError(409, "Idempotency key already belongs to a different expense");
  }
  return toDTO(existing);
}

/** Cents-exact decimal-to-cents conversion for currency fields (Decimal(14,2)). */
export function decimalToCents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

/**
 * Expense writes are kept together with append-only provenance in a single
 * transaction, reusing the authenticated request transaction when present.
 */
export class JobExpensesService {
  constructor(private readonly db: PrismaClient = prisma) {}

  private async assertJobInOrg(jobId: string, orgId: string): Promise<{ id: string; projectId: string }> {
    const job = await this.db.job.findFirst({ where: { id: jobId, orgId } });
    if (!job) throw new ApiError(404, `Job ${jobId} not found`);
    return { id: job.id, projectId: job.projectId };
  }

  private async findExpenseOrThrow(id: string, orgId: string, jobId?: string): Promise<JobExpenseRow> {
    const row = await this.db.jobExpense.findFirst({ where: { id, orgId, ...(jobId ? { jobId } : {}) } });
    if (!row) throw new ApiError(404, "Job expense not found");
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

  async getById(id: string, orgId: string, jobId?: string): Promise<JobExpenseDTO> {
    return toDTO(await this.findExpenseOrThrow(id, orgId, jobId));
  }

  async listAuditEvents(id: string, orgId: string, jobId: string): Promise<JobExpenseEventDTO[]> {
    await this.findExpenseOrThrow(id, orgId, jobId);
    const rows = await this.db.jobExpenseEvent.findMany({
      where: { expenseId: id, orgId, jobId }, orderBy: { createdAt: "asc" },
    });
    return rows.map((event) => ({
      id: event.id, expenseId: event.expenseId,
      eventType: event.eventType as JobExpenseEventDTO["eventType"],
      actorUserId: event.actorUserId, createdAt: event.createdAt.toISOString(),
      payload: event.payloadJson,
    }));
  }

  async create(input: CreateJobExpenseInput): Promise<JobExpenseDTO> {
    const amountCents = assertValidAmountCents(input.amountCents);
    const category = assertValidCategory(input.category);
    const paymentResponsibility = assertValidPaymentResponsibility(input.paymentResponsibility ?? "contractor");
    if (input.currency !== undefined && input.currency !== "USD") throw new ApiError(400, "Only USD is supported");
    const description = normalizeText(input.description, 2000, "description");
    const vendor = normalizeText(input.vendor, 200, "vendor");
    const receiptNote = normalizeText(input.receiptNote, 2000, "receiptNote");
    const incurredOn = assertValidDate(input.incurredOn, "incurredOn");
    const idempotencyKey = assertSubmissionKey(input.idempotencyKey);
    const job = await this.assertJobInOrg(input.jobId, input.orgId);
    const expected = { amountCents, category, paymentResponsibility, description, vendor, receiptNote, incurredOn, actorUserId: input.actorUserId };
    if (idempotencyKey) {
      const existing = await this.db.jobExpense.findFirst({
        where: { orgId: input.orgId, jobId: job.id, idempotencyKey },
      });
      if (existing) return assertSameSubmission(existing as JobExpenseRow, expected);
    }
    return runInDatabaseTransaction(this.db, async (tx) => {
      const candidateId = randomUUID();
      const data = {
        id: candidateId, orgId: input.orgId, jobId: job.id,
        amountCents, currency: "USD", description, category, paymentResponsibility,
        vendor, receiptNote, incurredOn, createdById: input.actorUserId,
        idempotencyKey,
      };
      const row = idempotencyKey
        ? await tx.jobExpense.upsert({
          where: { orgId_jobId_idempotencyKey: { orgId: input.orgId, jobId: job.id, idempotencyKey } },
          create: data, update: {},
        })
        : await tx.jobExpense.create({ data });
      if (row.id !== candidateId) return assertSameSubmission(row as JobExpenseRow, expected);
      await tx.jobExpenseEvent.create({
        data: {
          orgId: input.orgId, jobId: job.id, expenseId: row.id,
          actorUserId: input.actorUserId, eventType: "created",
          payloadJson: { after: auditSnapshot(row as JobExpenseRow) },
        },
      });
      return toDTO(row as JobExpenseRow);
    });
  }

  async update(input: UpdateJobExpenseInput): Promise<JobExpenseDTO> {
    const existing = await this.findExpenseOrThrow(input.id, input.orgId, input.jobId);
    assertLive(existing);
    const data: {
      amountCents?: number; category?: ExpenseCategory; description?: string;
      paymentResponsibility?: ExpensePaymentResponsibility; vendor?: string;
      receiptNote?: string; incurredOn?: Date;
    } = {};
    if (input.amountCents !== undefined) data.amountCents = assertValidAmountCents(input.amountCents);
    if (input.category !== undefined) data.category = assertValidCategory(input.category);
    if (input.description !== undefined) data.description = normalizeText(input.description, 2000, "description");
    if (input.paymentResponsibility !== undefined) data.paymentResponsibility = assertValidPaymentResponsibility(input.paymentResponsibility);
    if (input.vendor !== undefined) data.vendor = normalizeText(input.vendor, 200, "vendor");
    if (input.receiptNote !== undefined) data.receiptNote = normalizeText(input.receiptNote, 2000, "receiptNote");
    if (input.incurredOn !== undefined) data.incurredOn = assertValidDate(input.incurredOn, "incurredOn");
    if (Object.keys(data).length === 0) return toDTO(existing);
    return runInDatabaseTransaction(this.db, async (tx) => {
      const row = await tx.jobExpense.update({
        where: { id: existing.id, orgId: input.orgId, jobId: existing.jobId, voidedAt: null },
        data,
      });
      await tx.jobExpenseEvent.create({
        data: {
          orgId: input.orgId, jobId: existing.jobId, expenseId: existing.id,
          actorUserId: input.actorUserId ?? existing.createdById,
          eventType: "updated", payloadJson: {
            before: auditSnapshot(existing), after: auditSnapshot(row as JobExpenseRow),
          },
        },
      });
      return toDTO(row as JobExpenseRow);
    });
  }

  async attachReceipt(input: AttachJobExpenseReceiptInput): Promise<JobExpenseDTO> {
    const existing = await this.findExpenseOrThrow(input.id, input.orgId, input.jobId);
    assertLive(existing);
    const prefix = `job-expenses/${input.orgId}/${input.jobId}/${input.id}/`;
    const suffix = input.receiptStoragePath.startsWith(prefix)
      ? input.receiptStoragePath.slice(prefix.length)
      : "";
    const extension = RECEIPT_TYPES[input.receiptContentType];
    if (!extension || !RECEIPT_FILE.test(suffix) || !suffix.endsWith(`.${extension}`) ||
        input.receiptStoragePath.length > 500) {
      throw new ApiError(400, "Receipt path must belong to this organization's job and expense");
    }
    const receiptFileName = normalizeText(input.receiptFileName, 200, "receiptFileName");
    if (!receiptFileName || !Number.isInteger(input.receiptSizeBytes) ||
        input.receiptSizeBytes < 1 || input.receiptSizeBytes > MAX_RECEIPT_BYTES) {
      throw new ApiError(400, "Invalid receipt name or size");
    }
    if (existing.receiptStoragePath) {
      if (existing.receiptStoragePath === input.receiptStoragePath) return toDTO(existing);
      throw new ApiError(409, "This expense already has a receipt");
    }
    return runInDatabaseTransaction(this.db, async (tx) => {
      const row = await tx.jobExpense.update({
        where: { id: existing.id, orgId: input.orgId, jobId: input.jobId,
          voidedAt: null, receiptStoragePath: null },
        data: {
          receiptStoragePath: input.receiptStoragePath, receiptFileName,
          receiptContentType: input.receiptContentType, receiptSizeBytes: input.receiptSizeBytes,
        },
      });
      await tx.jobExpenseEvent.create({
        data: { orgId: input.orgId, jobId: input.jobId, expenseId: input.id,
          actorUserId: input.actorUserId ?? existing.createdById,
          eventType: "receipt_linked",
          payloadJson: { receiptFileName, receiptContentType: input.receiptContentType, receiptSizeBytes: input.receiptSizeBytes },
        },
      });
      return toDTO(row as JobExpenseRow);
    });
  }

  /** Never hard-delete financial evidence; void and retain actor/time/reason. */
  async remove(id: string, orgId: string, jobId?: string, actorUserId?: string, reason = ""): Promise<void> {
    const existing = await this.findExpenseOrThrow(id, orgId, jobId);
    if (existing.voidedAt) return;
    const voidReason = normalizeText(reason, 500, "voidReason");
    await runInDatabaseTransaction(this.db, async (tx) => {
      const row = await tx.jobExpense.update({
        where: { id, orgId, jobId: existing.jobId, voidedAt: null },
        data: { voidedAt: new Date(), voidedById: actorUserId ?? existing.createdById, voidReason },
      });
      await tx.jobExpenseEvent.create({
        data: { orgId, jobId: existing.jobId, expenseId: id,
          actorUserId: actorUserId ?? existing.createdById,
          eventType: "voided", payloadJson: {
            before: auditSnapshot(existing), after: auditSnapshot(row as JobExpenseRow),
          },
        },
      });
    });
  }

  /** Actual costs and customer-purchased materials are never conflated. */
  async getJobCostSummary(jobId: string, orgId: string): Promise<JobCostSummaryDTO> {
    const job = await this.assertJobInOrg(jobId, orgId);
    const [rows, latestEstimate] = await Promise.all([
      this.db.jobExpense.findMany({ where: { jobId, orgId, voidedAt: null } }),
      this.db.estimate.findFirst({
        where: { projectId: job.projectId }, orderBy: [{ version: "desc" }],
      }),
    ]);
    const byCategoryCents: Record<string, number> = {};
    let actualCents = 0;
    let customerPaidCents = 0;
    let activeCount = 0;
    for (const row of rows as JobExpenseRow[]) {
      if (row.voidedAt) continue;
      activeCount++;
      if (row.paymentResponsibility === "customer") {
        customerPaidCents += row.amountCents;
        continue;
      }
      actualCents += row.amountCents;
      byCategoryCents[row.category] = (byCategoryCents[row.category] ?? 0) + row.amountCents;
    }
    const estimatedCents = latestEstimate ? decimalToCents(latestEstimate.totalPrice) : null;
    return {
      jobId, projectId: job.projectId, expenseCount: activeCount,
      actualCents, customerPaidCents, byCategoryCents,
      estimatedCents, estimateId: latestEstimate?.id ?? null,
      varianceCents: estimatedCents === null ? null : estimatedCents - actualCents,
      recognizedRevenueCents: null, profitCents: null,
      profitStatus: "revenue_not_attributed_to_job",
    };
  }
}
