import { JobExpensesService } from "../modules/expenses/service";

const mockDb = {
  job: { findFirst: jest.fn() },
  jobExpense: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), upsert: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
  jobExpenseEvent: { create: jest.fn(), findMany: jest.fn() },
  estimate: { findFirst: jest.fn() },
  $queryRaw: jest.fn(),
};

(mockDb as any).$transaction = jest.fn(async (callback: (transaction: typeof mockDb) => Promise<unknown>) => callback(mockDb));

const ORG = "org-1";
const JOB = "10000000-0000-0000-0000-000000000001";
const ACTOR = "user-1";
const DAY = new Date(Date.UTC(2026, 10, 1));

function expenseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "expense-1",
    jobId: JOB,
    orgId: ORG,
    amountCents: 1999,
    category: "material",
    vendor: "ABC Supply",
    receiptNote: "Shingles",
    currency: "USD",
    description: "Roof repair supplies",
    idempotencyKey: null,
    receiptStoragePath: null,
    receiptFileName: null,
    receiptContentType: null,
    receiptSizeBytes: null,
    voidedAt: null,
    voidedById: null,
    voidReason: "",
    incurredOn: DAY,
    createdById: ACTOR,
    createdAt: new Date("2026-11-01T12:00:00.000Z"),
    updatedAt: new Date("2026-11-01T12:00:00.000Z"),
    ...overrides,
  };
}

describe("JobExpensesService", () => {
  const service = new JobExpensesService(mockDb as any);

  beforeEach(() => {
    jest.resetAllMocks();
    (mockDb as any).$transaction.mockImplementation(async (callback: (transaction: typeof mockDb) => Promise<unknown>) => callback(mockDb));
    mockDb.job.findFirst.mockResolvedValue({ id: JOB, projectId: "project-1" });
    mockDb.$queryRaw.mockResolvedValue([{ id: "expense-1" }]);
  });

  it("creates an expense scoped to the caller's org and job", async () => {
    mockDb.jobExpense.create.mockResolvedValue(expenseRow());
    const created = await service.create({
      orgId: ORG,
      jobId: JOB,
      actorUserId: ACTOR,
      amountCents: 1999,
      category: "material",
      vendor: "  ABC Supply  ",
      receiptNote: "Shingles",
      incurredOn: DAY,
    });
    expect(mockDb.job.findFirst).toHaveBeenCalledWith({ where: { id: JOB, orgId: ORG } });
    expect(mockDb.jobExpense.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orgId: ORG, jobId: JOB, amountCents: 1999, vendor: "ABC Supply", createdById: ACTOR }) }),
    );
    expect(created.amountCents).toBe(1999);
    expect(created.incurredOn).toBe("2026-11-01");
  });

  it("records customer-paid expenses without treating them as contractor purchases", async () => {
    mockDb.jobExpense.create.mockResolvedValue(expenseRow({ paymentResponsibility: "customer" }));
    const created = await service.create({
      orgId: ORG, jobId: JOB, actorUserId: ACTOR,
      amountCents: 4000, category: "material", incurredOn: DAY,
      paymentResponsibility: "customer",
    });
    expect(mockDb.jobExpense.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paymentResponsibility: "customer" }),
    }));
    expect(created.paymentResponsibility).toBe("customer");
  });

  it("excludes customer-paid purchases from contractor actuals and variance", async () => {
    mockDb.jobExpense.findMany.mockResolvedValue([
      expenseRow({ id: "contractor", amountCents: 2500, category: "labor", paymentResponsibility: "contractor" }),
      expenseRow({ id: "customer", amountCents: 4000, category: "material", paymentResponsibility: "customer" }),
    ]);
    mockDb.estimate.findFirst.mockResolvedValue({ id: "estimate-9", totalPrice: 100, version: 1 });
    const summary = await service.getJobCostSummary(JOB, ORG);
    expect(summary.actualCents).toBe(2500);
    expect(summary.customerPaidCents).toBe(4000);
    expect(summary.byCategoryCents).toEqual({ labor: 2500 });
    expect(summary.varianceCents).toBe(7500);
    expect(summary.expenseCount).toBe(2);
  });

  it("moves an updated contractor expense into customer totals without double-counting", async () => {
    mockDb.jobExpense.findFirst.mockResolvedValue(
      expenseRow({ amountCents: 4000, paymentResponsibility: "contractor" }),
    );
    mockDb.jobExpense.update.mockResolvedValue(
      expenseRow({ amountCents: 4000, paymentResponsibility: "customer" }),
    );
    const updated = await service.update({
      id: "expense-1", orgId: ORG, paymentResponsibility: "customer",
    });
    expect(mockDb.jobExpense.update).toHaveBeenCalledWith({
      where: { id: "expense-1", orgId: ORG, jobId: JOB, voidedAt: null },
      data: { paymentResponsibility: "customer" },
    });
    expect(updated.paymentResponsibility).toBe("customer");

    mockDb.jobExpense.findMany.mockResolvedValue([
      expenseRow({ amountCents: 4000, paymentResponsibility: "customer" }),
      expenseRow({ id: "contractor-2", amountCents: 1300, paymentResponsibility: "contractor" }),
    ]);
    mockDb.estimate.findFirst.mockResolvedValue(null);
    const summary = await service.getJobCostSummary(JOB, ORG);
    expect(summary.actualCents).toBe(1300);
    expect(summary.customerPaidCents).toBe(4000);
    expect(summary.byCategoryCents).toEqual({ material: 1300 });
    expect(summary.expenseCount).toBe(2);
  });

  it("records the locked, freshly reread state before a concurrent update", async () => {
    const stale = expenseRow({ amountCents: 1900 });
    const fresh = expenseRow({ amountCents: 2500 });
    mockDb.jobExpense.findFirst.mockResolvedValueOnce(stale).mockResolvedValueOnce(fresh);
    mockDb.jobExpense.update.mockResolvedValue(expenseRow({ amountCents: 3000 }));

    await service.update({ id: "expense-1", orgId: ORG, amountCents: 3000 });

    expect(mockDb.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockDb.jobExpenseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "updated",
        payloadJson: expect.objectContaining({
          before: expect.objectContaining({ amountCents: 2500 }),
          after: expect.objectContaining({ amountCents: 3000 }),
        }),
      }),
    });
  });

  it("does not create a second void event when another request voids after the initial read", async () => {
    const live = expenseRow();
    const alreadyVoided = expenseRow({
      voidedAt: new Date("2026-11-02T09:00:00.000Z"),
      voidedById: ACTOR, voidReason: "Duplicate",
    });
    mockDb.jobExpense.findFirst.mockResolvedValueOnce(live).mockResolvedValueOnce(alreadyVoided);

    await expect(service.remove("expense-1", ORG, JOB, ACTOR)).resolves.toBeUndefined();

    expect(mockDb.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockDb.jobExpense.update).not.toHaveBeenCalled();
    expect(mockDb.jobExpenseEvent.create).not.toHaveBeenCalled();
  });

  it("records a freshly locked snapshot before voiding an expense", async () => {
    const stale = expenseRow({ amountCents: 1900 });
    const fresh = expenseRow({ amountCents: 2500 });
    mockDb.jobExpense.findFirst.mockResolvedValueOnce(stale).mockResolvedValueOnce(fresh);
    mockDb.jobExpense.update.mockResolvedValue(expenseRow({ amountCents: 2500, voidedAt: new Date(), voidedById: ACTOR }));

    await service.remove("expense-1", ORG, JOB, ACTOR);

    expect(mockDb.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockDb.jobExpenseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "voided",
        payloadJson: expect.objectContaining({ before: expect.objectContaining({ amountCents: 2500 }) }),
      }),
    });
  });

  it("returns 404 when the job belongs to another org", async () => {
    mockDb.job.findFirst.mockResolvedValue(null);
    await expect(
      service.create({ orgId: ORG, jobId: JOB, actorUserId: ACTOR, amountCents: 100, category: "labor", incurredOn: DAY }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockDb.jobExpense.create).not.toHaveBeenCalled();
  });

  it("rejects non-positive and fractional-cent amounts", async () => {
    for (const amountCents of [0, -5, 10.5]) {
      await expect(
        service.create({ orgId: ORG, jobId: JOB, actorUserId: ACTOR, amountCents, category: "labor", incurredOn: DAY }),
      ).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(mockDb.jobExpense.create).not.toHaveBeenCalled();
  });

  it("rejects categories outside the estimate cost-type vocabulary", async () => {
    await expect(
      service.create({ orgId: ORG, jobId: JOB, actorUserId: ACTOR, amountCents: 100, category: "meals" as any, incurredOn: DAY }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("lists expenses only after the org-scoped job lookup", async () => {
    mockDb.jobExpense.findMany.mockResolvedValue([expenseRow(), expenseRow({ id: "expense-2", amountCents: 1, category: "labor" })]);
    const rows = await service.list(JOB, ORG);
    expect(rows).toHaveLength(2);
    expect(mockDb.jobExpense.findMany).toHaveBeenCalledWith({
      where: { jobId: JOB, orgId: ORG },
      orderBy: [{ incurredOn: "desc" }, { createdAt: "desc" }],
    });
  });

  it("returns 404 for cross-org expense reads, updates, and deletes", async () => {
    mockDb.jobExpense.findFirst.mockResolvedValue(null);
    await expect(service.getById("expense-9", ORG)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.update({ id: "expense-9", orgId: ORG, amountCents: 500 })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.remove("expense-9", ORG)).rejects.toMatchObject({ statusCode: 404 });
    expect(mockDb.jobExpense.update).not.toHaveBeenCalled();
    expect(mockDb.jobExpense.delete).not.toHaveBeenCalled();
  });

  it("applies partial updates without touching unspecified fields", async () => {
    mockDb.jobExpense.findFirst.mockResolvedValue(expenseRow());
    mockDb.jobExpense.update.mockResolvedValue(expenseRow({ amountCents: 2500 }));
    const updated = await service.update({ id: "expense-1", orgId: ORG, amountCents: 2500 });
    expect(mockDb.jobExpense.update).toHaveBeenCalledWith({
      where: { id: "expense-1", orgId: ORG, jobId: JOB, voidedAt: null }, data: { amountCents: 2500 },
    });
    expect(updated.amountCents).toBe(2500);
  });

  it("sums actuals in integer cents and compares against the latest estimate version", async () => {
    mockDb.jobExpense.findMany.mockResolvedValue([
      expenseRow({ amountCents: 1999, category: "material" }),
      expenseRow({ id: "expense-2", amountCents: 1, category: "material" }),
      expenseRow({ id: "expense-3", amountCents: 5000, category: "labor" }),
    ]);
    mockDb.estimate.findFirst.mockResolvedValue({ id: "estimate-9", totalPrice: 975.1, version: 3 });
    const summary = await service.getJobCostSummary(JOB, ORG);
    expect(mockDb.estimate.findFirst).toHaveBeenCalledWith({
      where: { projectId: "project-1" },
      orderBy: [{ version: "desc" }],
    });
    expect(summary.actualCents).toBe(7000);
    expect(summary.byCategoryCents).toEqual({ material: 2000, labor: 5000 });
    expect(summary.estimatedCents).toBe(97510);
    expect(summary.varianceCents).toBe(97510 - 7000);
    expect(summary.expenseCount).toBe(3);
    expect(summary.estimateId).toBe("estimate-9");
  });

  it("deduplicates an expense create using the same key and exact payload", async () => {
    const row = expenseRow({ idempotencyKey: "11111111-1111-4111-8111-111111111111" });
    mockDb.jobExpense.findFirst.mockResolvedValue({ ...row, description: "" });
    const result = await service.create({
      orgId: ORG, jobId: JOB, actorUserId: ACTOR, amountCents: 1999,
      category: "material", vendor: "ABC Supply", receiptNote: "Shingles", incurredOn: DAY,
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.id).toBe("expense-1");
    expect(mockDb.jobExpense.create).not.toHaveBeenCalled();
  });

  it("does not double-write under a concurrent duplicate submission", async () => {
    const key = "11111111-1111-4111-8111-111111111111";
    const existing = expenseRow({ idempotencyKey: key, description: "" });
    mockDb.jobExpense.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    mockDb.jobExpense.createMany.mockResolvedValue({ count: 0 });
    const result = await service.create({
      orgId: ORG, jobId: JOB, actorUserId: ACTOR, amountCents: 1999,
      category: "material", vendor: "ABC Supply", receiptNote: "Shingles",
      incurredOn: DAY, idempotencyKey: key,
    });
    expect(result.id).toBe(existing.id);
    expect(mockDb.jobExpenseEvent.create).not.toHaveBeenCalled();
  });

  it("rejects reuse of an idempotency key with different expense data", async () => {
    mockDb.jobExpense.findFirst.mockResolvedValue(expenseRow({
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    }));
    await expect(service.create({
      orgId: ORG, jobId: JOB, actorUserId: ACTOR,
      amountCents: 2500, category: "material", incurredOn: DAY,
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects expense detail reads under another job even in the same organization", async () => {
    mockDb.jobExpense.findFirst.mockResolvedValue(null);
    await expect(service.getById("expense-1", ORG, "another-job")).rejects.toMatchObject({ statusCode: 404 });
    expect(mockDb.jobExpense.findFirst).toHaveBeenCalledWith({
      where: { id: "expense-1", orgId: ORG, jobId: "another-job" },
    });
  });

  it("links only a receipt path under the verified job and expense namespace", async () => {
    mockDb.jobExpense.findFirst.mockResolvedValue(expenseRow());
    const receiptStoragePath = "job-expenses/org-1/10000000-0000-0000-0000-000000000001/expense-1/receipt-11111111-1111-4111-8111-111111111111.pdf";
    mockDb.jobExpense.update.mockResolvedValue(expenseRow({
      receiptStoragePath, receiptFileName: "bill.pdf", receiptContentType: "application/pdf", receiptSizeBytes: 2048,
    }));
    const linked = await service.attachReceipt({
      id: "expense-1", jobId: JOB, orgId: ORG, receiptStoragePath,
      receiptFileName: "bill.pdf", receiptContentType: "application/pdf", receiptSizeBytes: 2048,
    });
    expect(linked.receiptStoragePath).toBe(receiptStoragePath);
    await expect(service.attachReceipt({
      id: "expense-1", jobId: JOB, orgId: ORG,
      receiptStoragePath: "job-expenses/other-org/wrong/receipt.pdf",
      receiptFileName: "bill.pdf", receiptContentType: "application/pdf", receiptSizeBytes: 2048,
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("soft-voids expenses with actor provenance and excludes them from actual costs", async () => {
    mockDb.jobExpense.findFirst.mockResolvedValue(expenseRow());
    mockDb.jobExpense.update.mockResolvedValue(expenseRow({ voidedAt: new Date(), voidedById: ACTOR }));
    await service.remove("expense-1", ORG, JOB, ACTOR);
    const update = mockDb.jobExpense.update.mock.calls[0][0];
    expect(update.where).toMatchObject({ id: "expense-1", orgId: ORG, jobId: JOB, voidedAt: null });
    expect(update.data.voidedById).toBe(ACTOR);
    expect(update.data.voidedAt).toBeInstanceOf(Date);
    mockDb.jobExpense.findMany.mockResolvedValue([
      expenseRow({ voidedAt: new Date(), amountCents: 2500 }),
      expenseRow({ id: "active", amountCents: 1000 }),
    ]);
    mockDb.estimate.findFirst.mockResolvedValue(null);
    const summary = await service.getJobCostSummary(JOB, ORG);
    expect(summary.actualCents).toBe(1000);
    expect(summary.expenseCount).toBe(1);
  });

  it("reports null estimate figures when the project has no estimate", async () => {
    mockDb.jobExpense.findMany.mockResolvedValue([]);
    mockDb.estimate.findFirst.mockResolvedValue(null);
    const summary = await service.getJobCostSummary(JOB, ORG);
    expect(summary).toMatchObject({ actualCents: 0, estimatedCents: null, varianceCents: null, estimateId: null, expenseCount: 0 });
  });
});
