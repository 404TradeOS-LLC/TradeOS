import { Prisma, PrismaClient } from "@prisma/client";
import { getRequestDatabaseClient, runWithDatabaseSession } from "../db/requestSession";
import { getRolePermissions } from "../domain";

const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });

const orgA = "31000000-0000-0000-0000-000000000001";
const orgB = "32000000-0000-0000-0000-000000000002";
const userA = "31000000-0000-0000-0000-000000000011";
const userB = "32000000-0000-0000-0000-000000000012";
const membershipA = "31000000-0000-0000-0000-000000000021";
const membershipB = "32000000-0000-0000-0000-000000000022";
const projectA = "31000000-0000-0000-0000-000000000031";
const projectB = "32000000-0000-0000-0000-000000000032";
const invoiceA = "31000000-0000-0000-0000-000000000041";
const invoiceB = "32000000-0000-0000-0000-000000000042";
const lineA = "31000000-0000-0000-0000-000000000051";
const lineB = "32000000-0000-0000-0000-000000000052";

const authA = {
  userId: userA,
  orgId: orgA,
  role: "admin" as const,
  canonicalRole: "admin" as const,
  permissions: getRolePermissions("admin"),
  email: "invoice-contract-a@example.com",
};

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for integration tests`);
  return value;
}

describe("invoice line-item price contract migration on PostgreSQL", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({
      data: [
        { id: orgA, name: "Invoice Contract Org A" },
        { id: orgB, name: "Invoice Contract Org B" },
      ],
    });
    await adminClient.appUser.createMany({
      data: [
        { id: userA, authSubject: "invoice-contract-a", email: authA.email },
        { id: userB, authSubject: "invoice-contract-b", email: "invoice-contract-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: membershipA, orgId: orgA, userId: userA, role: "admin", status: "active" },
        { id: membershipB, orgId: orgB, userId: userB, role: "admin", status: "active" },
      ],
    });
    await adminClient.project.createMany({
      data: [
        { id: projectA, orgId: orgA, name: "Invoice Contract Project A" },
        { id: projectB, orgId: orgB, name: "Invoice Contract Project B" },
      ],
    });
    await adminClient.invoice.createMany({
      data: [
        { id: invoiceA, projectId: projectA, invoiceNumber: 9101, type: "full", status: "draft", amount: 24.69 },
        { id: invoiceB, projectId: projectB, invoiceNumber: 9201, type: "full", status: "draft", amount: 99.99 },
      ],
    });
    await adminClient.invoiceLineItem.createMany({
      data: [
        {
          id: lineA,
          invoiceId: invoiceA,
          description: "Canonical A",
          quantity: 2,
          unitOfMeasure: "EA",
          unitPrice: 12.3456,
          lineTotal: 24.69,
        },
        {
          id: lineB,
          invoiceId: invoiceB,
          description: "Canonical B",
          quantity: 1,
          unitOfMeasure: "EA",
          unitPrice: 99.99,
          lineTotal: 99.99,
        },
      ],
    });
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await adminClient.appUser.deleteMany({ where: { id: { in: [userA, userB] } } });
    await Promise.all([adminClient.$disconnect(), appClient.$disconnect()]);
  });

  it("preserves canonical data and removes only the compatibility objects", async () => {
    const columns = await adminClient.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'invoice_line_items'
      order by ordinal_position
    `);
    const columnNames = columns.map((row) => row.column_name);
    expect(columnNames).toEqual(expect.arrayContaining(["unit_price", "line_total"]));
    expect(columnNames).not.toEqual(expect.arrayContaining(["unit_cost", "line_cost"]));

    const row = await adminClient.invoiceLineItem.findUniqueOrThrow({ where: { id: lineA } });
    expect(Number(row.unitPrice)).toBe(12.3456);
    expect(Number(row.lineTotal)).toBe(24.69);

    const triggers = await adminClient.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      select count(*)::bigint as count
      from pg_trigger
      where tgrelid = 'public.invoice_line_items'::regclass
        and tgname = 'invoice_line_item_price_columns_sync'
        and not tgisinternal
    `);
    expect(Number(triggers[0]?.count ?? 0)).toBe(0);

    const functions = await adminClient.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      select count(*)::bigint as count
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'sync_invoice_line_item_price_columns'
    `);
    expect(Number(functions[0]?.count ?? 0)).toBe(0);
  });

  it("preserves the invoice-line index, constraints, and forced RLS", async () => {
    const table = await adminClient.$queryRaw<Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>>(Prisma.sql`
      select relrowsecurity, relforcerowsecurity
      from pg_class
      where oid = 'public.invoice_line_items'::regclass
    `);
    expect(table).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);

    const indexes = await adminClient.$queryRaw<Array<{ indexname: string }>>(Prisma.sql`
      select indexname
      from pg_indexes
      where schemaname = 'public' and tablename = 'invoice_line_items'
    `);
    expect(indexes.map((row) => row.indexname)).toEqual(
      expect.arrayContaining(["invoice_line_items_pkey", "idx_invoice_line_items_invoice"])
    );

    const constraints = await adminClient.$queryRaw<Array<{ contype: string }>>(Prisma.sql`
      select contype::text
      from pg_constraint
      where conrelid = 'public.invoice_line_items'::regclass
    `);
    expect(constraints.map((row) => row.contype)).toEqual(expect.arrayContaining(["p", "f"]));
  });

  it("keeps tenant-scoped RLS effective after the contraction", async () => {
    const visible = await runWithDatabaseSession(appClient, authA, async () =>
      getRequestDatabaseClient()!.invoiceLineItem.findMany({ orderBy: { id: "asc" } })
    );

    expect(visible.map((row) => row.id)).toEqual([lineA]);
    expect(visible.some((row) => row.id === lineB)).toBe(false);
  });
});
