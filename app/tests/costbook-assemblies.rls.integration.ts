import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";
import { AssembliesDatabaseService } from "../modules/assemblies-database/service";

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
const excavationItemA = "76000000-0000-0000-0000-000000000063";
const haulItemA = "76000000-0000-0000-0000-000000000064";
const excavationEquipmentA = "76000000-0000-0000-0000-000000000065";
const assemblyA = "76000000-0000-0000-0000-000000000071";
const assemblyB = "86000000-0000-0000-0000-000000000072";
const service = new AssembliesDatabaseService();

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
    await inSession(ownerA, orgA, "owner", () => prisma.equipment.create({ data: { id: excavationEquipmentA, orgId: orgA, name: "Excavation crew" } }));
    await inSession(ownerA, orgA, "owner", () => prisma.costItem.createMany({ data: [
      { id: excavationItemA, orgId: orgA, subcategoryId: subA, code: "EXC-A", name: "Excavation", unitOfMeasure: "CY", equipmentId: excavationEquipmentA },
      { id: haulItemA, orgId: orgA, subcategoryId: subA, code: "HAUL-A", name: "Haul allowance", unitOfMeasure: "CY" },
    ] }));
    await inSession(ownerA, orgA, "owner", () => prisma.assembly.create({ data: { id: assemblyA, orgId: orgA, code: "ASM-A", name: "Assembly A", unitOfMeasure: "EA" } }));
    await inSession(ownerB, orgB, "owner", () => prisma.assembly.create({ data: { id: assemblyB, orgId: orgB, code: "ASM-B", name: "Assembly B", unitOfMeasure: "EA" } }));
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("allows read-only Costbook roles to see only their tenant assemblies", async () => {
    const ownRows = await inSession(techA, orgA, "technician", () => prisma.assembly.findMany({ where: { id: assemblyA } }));
    const foreignById = await inSession(techA, orgA, "technician", () => prisma.assembly.findFirst({ where: { id: assemblyB } }));
    const allVisible = await inSession(techA, orgA, "technician", () => prisma.assembly.findMany({ orderBy: { id: "asc" } }));

    expect(ownRows.map((row) => row.id)).toEqual([assemblyA]);
    expect(foreignById).toBeNull();
    expect(allVisible.map((row) => row.id)).not.toContain(assemblyB);
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

  it("installs a reviewed starter recipe atomically inside the active tenant session", async () => {
    const installed = await inSession(ownerA, orgA, "owner", () => service.installStarterCatalogAssembly({
      orgId: orgA,
      templateId: "site-excavation",
      componentMappings: [
        { componentKey: "excavation", costItemId: excavationItemA },
        { componentKey: "haul", costItemId: haulItemA },
      ],
    }));

    const ownComponents = await inSession(ownerA, orgA, "owner", () => prisma.assemblyItem.findMany({
      where: { assemblyId: installed.id },
      orderBy: { sortOrder: "asc" },
    }));
    const foreignView = await inSession(ownerB, orgB, "owner", () => prisma.assembly.findFirst({ where: { id: installed.id } }));

    expect(installed.code).toBe("31 23 16-TOS-001");
    expect(ownComponents.map((row) => row.costItemId)).toEqual([excavationItemA, haulItemA]);
    expect(foreignView).toBeNull();
  });

  it("rejects foreign starter mappings without leaving a partial assembly", async () => {
    await expect(inSession(ownerA, orgA, "owner", () => service.installStarterCatalogAssembly({
      orgId: orgA,
      templateId: "slab-four-inch",
      componentMappings: [
        { componentKey: "base", costItemId: itemB },
        { componentKey: "concrete", costItemId: excavationItemA },
        { componentKey: "reinforcing", costItemId: itemA },
        { componentKey: "place-finish", costItemId: haulItemA },
      ],
    }))).rejects.toThrow("inactive or outside this organization");

    const partial = await inSession(ownerA, orgA, "owner", () => prisma.assembly.findFirst({
      where: { orgId: orgA, code: "03 30 00-TOS-001" },
    }));
    expect(partial).toBeNull();
  });
});

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Costbook assembly integration tests`);
  return value;
}
