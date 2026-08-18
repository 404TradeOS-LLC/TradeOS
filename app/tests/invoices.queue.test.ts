// InvoicesService.listOrganizationQueue computes paidAmount/balanceDue via
// raw SQL (Invoice has no stored balance column — see the method's own
// comment in modules/invoices/service.ts), so this unit test mocks
// `$queryRaw` and asserts on (a) the composed SQL text/bound values to prove
// each filter is actually wired in, and (b) DTO mapping/pagination-envelope
// logic given canned raw rows. The real end-to-end correctness of the SQL
// against live Postgres (including RLS/tenant isolation) is proven by
// tests/rls.integration.ts, consistent with this repo's existing stance that
// a mocked Prisma test cannot prove real database behavior.
const queryRawMock = jest.fn();

const mockPrisma = {
  $queryRaw: queryRawMock,
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { Prisma } from "@prisma/client";
import { InvoicesService } from "../modules/invoices/service";

function sqlOf(call: unknown): string {
  return (call as Prisma.Sql).sql;
}

function valuesOf(call: unknown): unknown[] {
  return (call as Prisma.Sql).values;
}

const RAW_ROW = {
  id: "inv-1",
  project_id: "project-1",
  invoice_number: 42,
  status: "sent",
  amount: "1000.00",
  due_date: new Date("2026-08-01T00:00:00.000Z"),
  updated_at: new Date("2026-08-10T00:00:00.000Z"),
  project_name: "Kitchen Remodel",
  customer_name: "Jane Homeowner",
  paid_amount: "400.00",
  balance_due: "600.00",
};

describe("InvoicesService.listOrganizationQueue", () => {
  const service = new InvoicesService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps documentNumber, amount, paidAmount, balanceDue, and dueDate using exact decimal values (no float coercion of the SQL-computed balance)", async () => {
    queryRawMock.mockResolvedValueOnce([RAW_ROW]).mockResolvedValueOnce([{ count: BigInt(1) }]);

    const result = await service.listOrganizationQueue({ orgId: "org-a" });

    expect(result.items[0]).toEqual({
      id: "inv-1",
      documentNumber: 42,
      projectId: "project-1",
      projectName: "Kitchen Remodel",
      customerName: "Jane Homeowner",
      status: "sent",
      amount: 1000,
      paidAmount: 400,
      balanceDue: 600,
      dueDate: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
    });
    expect(result.total).toBe(1);
  });

  it("scopes both the row query and the count query to the caller's organization", async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: BigInt(0) }]);

    await service.listOrganizationQueue({ orgId: "org-a" });

    const rowsCall = queryRawMock.mock.calls[0][0];
    const countCall = queryRawMock.mock.calls[1][0];
    expect(sqlOf(rowsCall)).toMatch(/where p\.org_id = \?/);
    expect(valuesOf(rowsCall)).toContain("org-a");
    expect(sqlOf(countCall)).toContain("count(*)::bigint");
    expect(valuesOf(countCall)).toContain("org-a");
  });

  it("wires the overdue predicate: due_date passed, balance_due > 0, voided excluded", async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: BigInt(0) }]);
    await service.listOrganizationQueue({ orgId: "org-a", overdue: true });

    const sql = sqlOf(queryRawMock.mock.calls[0][0]);
    expect(sql).toContain("due_date < now()");
    expect(sql).toContain("balance_due > 0");
    expect(sql).toMatch(/status NOT IN/);
    const values = valuesOf(queryRawMock.mock.calls[0][0]);
    expect(values).toEqual(expect.arrayContaining(["voided", "void", "cancelled"]));
  });

  it("wires the partiallyPaid predicate: paid_amount > 0 AND balance_due > 0", async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: BigInt(0) }]);
    await service.listOrganizationQueue({ orgId: "org-a", partiallyPaid: true });

    const sql = sqlOf(queryRawMock.mock.calls[0][0]);
    expect(sql).toContain("paid_amount > 0");
    expect(sql).toContain("balance_due > 0");
  });

  it("wires the unpaid predicate as balance_due > 0 (so partially-paid invoices are included, per spec)", async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: BigInt(0) }]);
    await service.listOrganizationQueue({ orgId: "org-a", unpaid: true });

    const sql = sqlOf(queryRawMock.mock.calls[0][0]);
    expect(sql).toContain("balance_due > 0");
    // unpaid must NOT additionally require paid_amount = 0 — that would wrongly
    // exclude partially-paid invoices, which the spec says are still unpaid.
    expect(sql).not.toContain("paid_amount = 0");
  });

  it("expands a requested canonical status to include its legacy raw synonyms", async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: BigInt(0) }]);
    await service.listOrganizationQueue({ orgId: "org-a", statuses: ["voided"] });

    const values = valuesOf(queryRawMock.mock.calls[0][0]);
    expect(values).toEqual(expect.arrayContaining(["voided", "void", "cancelled"]));
  });

  it("binds sent/updatedAfter/updatedBefore as real Date values", async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: BigInt(0) }]);
    await service.listOrganizationQueue({
      orgId: "org-a",
      sent: true,
      updatedAfter: "2026-08-01T00:00:00.000Z",
      updatedBefore: "2026-08-31T00:00:00.000Z",
    });

    const sql = sqlOf(queryRawMock.mock.calls[0][0]);
    const values = valuesOf(queryRawMock.mock.calls[0][0]);
    expect(sql).toContain("sent_at IS NOT NULL");
    expect(values.some((v) => v instanceof Date && v.toISOString() === "2026-08-01T00:00:00.000Z")).toBe(true);
    expect(values.some((v) => v instanceof Date && v.toISOString() === "2026-08-31T00:00:00.000Z")).toBe(true);
  });

  it("computes nextCursor only when a full page is returned, and encodes it from the last row", async () => {
    const fullPage = Array.from({ length: 2 }, (_, i) => ({ ...RAW_ROW, id: `inv-${i}`, updated_at: new Date(2026, 7, 10 - i) }));
    queryRawMock.mockResolvedValueOnce(fullPage).mockResolvedValueOnce([{ count: BigInt(5) }]);

    const result = await service.listOrganizationQueue({ orgId: "org-a", limit: 2 });
    expect(result.nextCursor).not.toBeNull();
    expect(result.total).toBe(5);
  });

  it("returns nextCursor null when fewer rows than the limit come back", async () => {
    queryRawMock.mockResolvedValueOnce([RAW_ROW]).mockResolvedValueOnce([{ count: BigInt(1) }]);

    const result = await service.listOrganizationQueue({ orgId: "org-a", limit: 25 });
    expect(result.nextCursor).toBeNull();
  });

  it("rejects a malformed cursor with a 400 ApiError before issuing any query", async () => {
    await expect(service.listOrganizationQueue({ orgId: "org-a", cursor: "not-a-cursor" })).rejects.toMatchObject({ statusCode: 400 });
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("clamps limit to the documented maximum of 50", async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: BigInt(0) }]);
    await service.listOrganizationQueue({ orgId: "org-a", limit: 500 });

    const values = valuesOf(queryRawMock.mock.calls[0][0]);
    expect(values[values.length - 1]).toBe(50);
  });

  it("regression: the count query never includes the cursor predicate, only the rows query does", async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: BigInt(0) }]);
    const cursor = Buffer.from(JSON.stringify({ u: "2026-08-01T00:00:00.000Z", i: "row-1" }), "utf8").toString("base64url");
    await service.listOrganizationQueue({ orgId: "org-a", cursor });

    const rowsSql = sqlOf(queryRawMock.mock.calls[0][0]);
    const countSql = sqlOf(queryRawMock.mock.calls[1][0]);
    expect(rowsSql).toContain("id < ?::uuid");
    expect(countSql).not.toContain("id < ?::uuid");
  });

  it("regression: the CTE projects sent_at so the sent filter can reference it in the outer query", async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: BigInt(0) }]);
    await service.listOrganizationQueue({ orgId: "org-a", sent: true });

    const sql = sqlOf(queryRawMock.mock.calls[0][0]);
    expect(sql).toMatch(/i\.sent_at/);
  });
});
