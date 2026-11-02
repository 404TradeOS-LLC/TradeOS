const list = jest.fn();
const getById = jest.fn();
const getJobCostSummary = jest.fn();
const create = jest.fn();
const update = jest.fn();
const remove = jest.fn();

jest.mock("../modules/expenses/service", () => ({
  JobExpensesService: jest.fn().mockImplementation(() => ({ list, getById, getJobCostSummary, create, update, remove })),
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
    expect(getById).toHaveBeenCalledWith(EXPENSE, "org-1");
    await expensesController.getSummary(baseReq(), res);
    expect(getJobCostSummary).toHaveBeenCalledWith(JOB, "org-1");
  });

  it("removes with 204 and no body", async () => {
    const res = responseDouble();
    await expensesController.remove(baseReq(), res);
    expect(remove).toHaveBeenCalledWith(EXPENSE, "org-1");
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});
