import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";

const appClient = new PrismaClient({ datasources: { db: { url: required("TEST_DATABASE_URL") } } });
const adminClient = new PrismaClient({ datasources: { db: { url: required("TEST_DATABASE_ADMIN_URL") } } });

const orgA = "76000000-0000-0000-0000-000000000001";
const orgB = "86000000-0000-0000-0000-000000000002";
const ownerA = "76000000-0000-0000-0000-000000000011";
const techA = "76000000-0000-0000-0000-000000000012";
const ownerB = "86000000-0000-0000-0000-000000000021";
const divisionA = "76000000-0000-0000-0000-000000000031";
const divisionB = "86000000-0000-0000-0000-000000000032";
const categoryA = "76000000-0000-0000-0000-000000000041";
const categoryB = "86000000-0000-0000-0000-000000000042";
const subA = "76000000-0000-0000-0000-000000000051";
const subB = "86000000-0000-0000-0000-000000000052";
const itemA = "76000000-0000-0000-0000-000000000061";
const itemB = "86000000-0000-0000-0000-000000000062";
const assemblyA = "76000000-0000-0000-0000-000000000071";

function inSession<T>(userId: string, orgId: string, role: SupportedRole, operation: () => Promise<T>) {
  return runWithDatabaseSession(appClient, { userId, orgId, role }, operation, "assembly-integration-test");
}

describe("live Costbook assembly RLS", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({ data: [{ id: orgA, name: "Assembly RLS A" }, { id: orgB, name: "Assembly RLS B" }] });
    await adminClient.appUser.createMany({ data: [
      { id: ownerA, authSubject: "assembly-owner-a", email: "assembly-owner-a@example.com" },
      { id: techA, authSubject: "assembly-tech-a", email: "assembly-tech-a@example.com" },
      { id: ownerB, authSubject: "assembly-owner-b", email: "assembly-owner-b@example.com" },
    ] });
    await adminClient.organizationMembership.createMany({ data: [
      { orgId: orgA, userId: ownerA, role: "owner", status: "active" },
      { orgId: orgA, userId: techA, role: "technician", status: "active" },
      { orgId: orgB, userId: ownerB, role: "owner", status: "active" },
    ] });

    await inSession(ownerA, orgA, "owner", () => prisma.division.create({ data: { id: divisionA, orgId: orgA, code: "A", name: "A" } }));
    await inSession(ownerB, orgB, "owner", () => prisma.division.create({ data: { id: divisionB, orgId: orgB, code: "B", name: "B" } }));
    await inSession(ownerA, orgA, "owner", () => prisma.category.create({ data: { id: categoryA, divisionId: divisionA, code: "A", name: "A" } }));
    await inSession(ownerB, orgB, "owner", () => prisma.category.create({ data: { id: categoryB, divisionId: divisionB, code: "B", name: "B" } }));
    await inSession(ownerA, orgA, "owner", () => prisma.subcategory.create({ data: { id: subA, categoryId: categoryA, code: "A", name: "A" } }));
    await inSession(ownerB, orgB, "owner", () => prisma.subcategory.create({ data: { id: subB, categoryId: categoryB, code: "B", name: "B" } }));
    await inSession(ownerA, orgA, "owner", () => prisma.costItem.create({ data: { id: itemA, orgId: orgA, subcategoryId: subA, code: "ITEM-A", name: "Item A", unitOfMeasure: "EA" } }));
    await inSession(ownerB, orgB, "owner", () => prisma.costItem.create({ data: { id: itemB, orgId: orgB, subcategoryId: subB, code: "ITEM-B", name: "Item B", unitOfMeasure: "EA" } }));
    await inSession(ownerA, orgA, "owner", () => prisma.assembly.create({ data: { id: assemblyA, orgId: orgA, code: "ASM-A", name: "Assembly A", unitOfMeasure: "EA" } }));
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("allows read-only Costbook roles to see their tenant assembly", async () => {
    const rows = await inSession(techA, orgA, "technician", () => prisma.assembly.findMany({ where: { id: assemblyA } }));
    expect(rows.map((row) => row.id)).toEqual([assemblyA]);
  });

  it("denies direct assembly writes to a read-only Costbook role", async () => {
    await expect(inSession(techA, orgA, "technician", () => prisma.assembly.create({
      data: { orgId: orgA, code: "TECH", name: "Denied", unitOfMeasure: "EA" },
    }))).rejects.toBeTruthy();
  });

  it("allows owner composition writes for same-organization components", async () => {
    const row = await inSession(ownerA, orgA, "owner", () => prisma.assemblyItem.create({
      data: { assemblyId: assemblyA, costItemId: itemA, quantityPerUnit: 2 },
    }));
    expect(row.costItemId).toBe(itemA);
  });

  it("rejects a cross-organization component even when the parent assembly is owned by the session org", async () => {
    await expect(inSession(ownerA, orgA, "owner", () => prisma.assemblyItem.create({
      data: { assemblyId: assemblyA, costItemId: itemB, quantityPerUnit: 1 },
    }))).rejects.toBeTruthy();
  });
});

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Costbook assembly integration tests`);
  return value;
}
