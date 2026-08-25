const queryRawMock = jest.fn();

jest.mock("../db/client", () => ({ prisma: { $queryRaw: queryRawMock } }));

import { Prisma } from "@prisma/client";
import { InvoicesService } from "../modules/invoices/service";

function sqlOf(call: unknown): string {
  return (call as Prisma.Sql).sql;
}

describe("InvoicesService.listOrganizationQueue paid balance regression", () => {
  it("keeps persisted paid authoritative when no Payment row exists", async () => {
    queryRawMock
      .mockResolvedValueOnce([
        {
          id: "10000000-0000-0000-0000-000000000001",
          project_id: "10000000-0000-0000-0000-000000000002",
          invoice_number: 205,
          status: "paid",
          amount: "750.00",
          due_date: new Date("2026-08-01T00:00:00.000Z"),
          updated_at: new Date("2026-08-10T00:00:00.000Z"),
          project_name: "Kitchen Remodel",
          customer_name: "Jane Homeowner",
          paid_amount: "0.00",
          balance_due: "0.00",
        },
      ])
      .mockResolvedValueOnce([{ count: BigInt(1) }]);

    const result = await new InvoicesService().listOrganizationQueue({ orgId: "10000000-0000-0000-0000-000000000003" });

    const sql = sqlOf(queryRawMock.mock.calls[0][0]);
    expect(sql).toContain("when i.status = 'paid' then 0");
    expect(sql).toContain("else greatest(i.amount - coalesce(pt.paid_amount, 0), 0)");
    expect(result).toMatchObject({ total: 1 });
    expect(result.items[0]).toMatchObject({ amount: 750, paidAmount: 0, balanceDue: 0 });
  });
});
