const queryRawMock = jest.fn();

jest.mock("../db/client", () => ({ prisma: { $queryRaw: queryRawMock } }));

import { Prisma } from "@prisma/client";
import { InvoicesService } from "../modules/invoices/service";

function sqlOf(call: unknown): string {
  return (call as Prisma.Sql).sql;
}

describe("InvoicesService.listOrganizationQueue paid balance regression", () => {
  it("keeps persisted paid authoritative when no Payment row exists", async () => {
    queryRawMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: BigInt(0) }]);

    await new InvoicesService().listOrganizationQueue({ orgId: "org-a" });

    const sql = sqlOf(queryRawMock.mock.calls[0][0]);
    expect(sql).toContain("when i.status = 'paid' then 0");
    expect(sql).toContain("else greatest(i.amount - coalesce(pt.paid_amount, 0), 0)");
  });
});
