const list = jest.fn();
const getById = jest.fn();
const getJobCostSummary = jest.fn();
const create = jest.fn();
const update = jest.fn();
const remove = jest.fn();
const attachReceipt = jest.fn();
const listAuditEvents = jest.fn();

jest.mock("../modules/expenses/service", () => ({
  JobExpensesService: jest.fn().mockImplementation(() => ({ list, getById, getJobCostSummary, create, update, remove, attachReceipt, listAuditEvents })),
}));

import { expensesController } from "../backend/controllers/expenses.controller";

const JOB = "10000000-0000-0000-0000-000000000001";
const EXPENSE = "20000000-0000-0000-0000-000000000002";

function responseDouble() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

function baseReq(overrides: Record<string, unknown> = {}) {
  return {
    params: { jobId: JOB, expenseId: EXPENSE },
    orgId: "org-1",
    auth: { userId: "user-1", orgId: "org-1", role: "owner" },
    ...overrides,
  } as any;
}

describe("expensesController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps create bodies into service input with a UTC-midnight incurred date", async () => {
    create.mockResolvedValue({ id: EXPENSE });
    const res = responseDouble();
    await expensesController.create(
      baseReq({ body: { amountCents: 1999, category: "material", vendor: "ABC", receiptNote: "Shingles", incurredOn: "2026-11-01" } }),
      res,
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        jobId: JOB,
        actorUserId: "user-1",
        amountCents: 1999,
        category: "material",
        incurredOn: new Date(Date.UTC(2026, 10, 1)),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("accepts an explicit customer payer and rejects unknown payer values", async () => {
    create.mockResolvedValue({ id: EXPENSE });
    const res = responseDouble();
    await expensesController.create(baseReq({
      body: { amountCents: 4000, category: "material", incurredOn: "2026-11-01", paymentResponsibility: "customer" },
    }), res);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ paymentResponsibility: "customer" }));
    create.mockClear();
    await expect(expensesController.create(baseReq({
      body: { amountCents: 4000, category: "material", incurredOn: "2026-11-01", paymentResponsibility: "someone_else" },
    }), res)).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("validates a UUID idempotency key on create", async () => {
    create.mockResolvedValue({ id: EXPENSE });
    const res = responseDouble();
    await expensesController.create(baseReq({
      body: {
        amountCents: 2500, currency: "USD", description: "Paint",
        category: "material", incurredOn: "2026-11-02",
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      },
    }), res);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      currency: "USD", description: "Paint",
    }));
    await expect(expensesController.create(baseReq({
      body: { amountCents: 2500, category: "material", incurredOn: "2026-11-02", idempotencyKey: "bad" },
    }), res)).rejects.toThrow();
  });

  it("rejects a zero amount and a non-calendar incurred date", async () => {
    const res = responseDouble();
    await expect(
      expensesController.create(baseReq({ body: { amountCents: 0, category: "labor", incurredOn: "2026-11-01" } }), res),
    ).rejects.toThrow();
    await expect(
      expensesController.create(baseReq({ body: { amountCents: 100, category: "labor", incurredOn: "2026-02-30" } }), res),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("lists, reads, and summarizes through the job-scoped service methods", async () => {
    list.mockResolvedValue([]);
    getById.mockResolvedValue({ id: EXPENSE });
    getJobCostSummary.mockResolvedValue({ jobId: JOB, actualCents: 0 });
    const res = responseDouble();
    await expensesController.list(baseReq(), res);
    expect(list).toHaveBeenCalledWith(JOB, "org-1");
    await expensesController.getById(baseReq(), res);
    expect(getById).toHaveBeenCalledWith(EXPENSE, "org-1", JOB);
    await expensesController.getSummary(baseReq(), res);
    expect(getJobCostSummary).toHaveBeenCalledWith(JOB, "org-1");
  });

  it("links only receipt metadata under the authenticated job and expense", async () => {
    attachReceipt.mockResolvedValue({ id: EXPENSE });
    const res = responseDouble();
    const receiptStoragePath = `job-expenses/org-1/${JOB}/${EXPENSE}/receipt-11111111-1111-4111-8111-111111111111.pdf`;
    await expensesController.attachReceipt(baseReq({
      body: { receiptStoragePath, receiptFileName: "receipt.pdf",
        receiptContentType: "application/pdf", receiptSizeBytes: 2048 },
    }), res);
    expect(attachReceipt).toHaveBeenCalledWith(expect.objectContaining({
      id: EXPENSE, jobId: JOB, orgId: "org-1", actorUserId: "user-1",
      receiptStoragePath,
    }));
    attachReceipt.mockClear();
    await expect(expensesController.attachReceipt(baseReq({
      body: { receiptStoragePath, receiptFileName: "receipt.html",
        receiptContentType: "text/html", receiptSizeBytes: 2048 },
    }), res)).rejects.toThrow();
    expect(attachReceipt).not.toHaveBeenCalled();
    await expect(expensesController.attachReceipt(baseReq({
      body: { receiptStoragePath, receiptFileName: "oversized.pdf",
        receiptContentType: "application/pdf", receiptSizeBytes: 4 * 1024 * 1024 + 1 },
    }), res)).rejects.toThrow();
    expect(attachReceipt).not.toHaveBeenCalled();
  });

  it("reads the audit log scoped to the URL job", async () => {
    listAuditEvents.mockResolvedValue([]);
    await expensesController.getAuditEvents(baseReq(), responseDouble());
    expect(listAuditEvents).toHaveBeenCalledWith(EXPENSE, "org-1", JOB);
  });

  it("removes with 204 and no body", async () => {
    const res = responseDouble();
    await expensesController.remove(baseReq(), res);
    expect(remove).toHaveBeenCalledWith(EXPENSE, "org-1", JOB, "user-1", undefined);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});
