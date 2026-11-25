import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";
import * as catalog from "../modules/assemblies-database/tradeosCatalogAdapter";
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

    expect(installed).toMatchObject({
      code: "31 23 16-TOS-001", installedRecipeId: "site-excavation",
      installedRecipeVersion: 1, currentRecipeVersion: 1, updateAvailable: false,
      installedAt: expect.any(Date),
    });
    expect(ownComponents.map((row) => row.recipeComponentKey)).toEqual(["excavation", "haul"]);
    expect(ownComponents.map((row) => row.costItemId)).toEqual([excavationItemA, haulItemA]);
    expect(foreignView).toBeNull();
  });

  it("reviews and applies one tenant upgrade atomically, preserving prices, mappings, and audit visibility", async () => {
    const recipe = catalog.getExpandedCatalogTemplate("site-excavation")!;
    const mappings = [
      { componentKey: "excavation", costItemId: excavationItemA },
      { componentKey: "haul", costItemId: haulItemA },
    ];
    const installLookup = jest.spyOn(catalog, "getExpandedCatalogTemplate")
      .mockReturnValueOnce({ ...recipe, code: "UPGRADE-FIXTURE" });
    const installed = await inSession(ownerA, orgA, "owner", () => service.installStarterCatalogAssembly({
      orgId: orgA, templateId: recipe.id, expectedRecipeVersion: 1, componentMappings: mappings,
      wasteOverridePct: 10, productionRateFactor: 0.9,
    })).finally(() => installLookup.mockRestore());
    const beforeRows = await adminClient.assemblyItem.findMany({ where: { assemblyId: installed.id }, orderBy: { sortOrder: "asc" } });
    const project = await adminClient.project.create({ data: { name: "Upgrade test", orgId: orgA } });
    const estimate = await adminClient.estimate.create({ data: {
      projectId: project.id, orgId: orgA, subtotalCost: 180, totalPrice: 200,
      lineItems: { create: {
        assemblyId: installed.id, description: "Reviewed estimate line", unitOfMeasure: "CY",
        quantity: 2, unitCost: 90, lineCost: 180,
      } },
    }, include: { lineItems: true } });
    const costWhere = { id: { in: [excavationItemA, haulItemA] } };
    const originalCostItems = await adminClient.costItem.findMany({ where: costWhere, orderBy: { id: "asc" } });
    const lookup = jest.spyOn(catalog, "getExpandedCatalogTemplate");
    lookup.mockReturnValue({
      ...recipe, version: 2, measurementBasis: "Loose cubic yard of soil",
      components: [
        { ...recipe.components[0], quantityPerUnit: 2 },
        { ...recipe.components[1], key: "disposal" },
      ],
    });

    try {
      const preview = await inSession(ownerA, orgA, "owner", () => service.previewRecipeUpgrade(installed.id, orgA));
      expect(preview).toMatchObject({ fromVersion: 1, toVersion: 2, updateAvailable: true, history: [] });
      expect(preview.changes.map(({ key, change, mapping }) => [key, change, mapping])).toEqual([
        ["excavation", "changed", "preserved"], ["haul", "removed", "removed"], ["disposal", "added", "needed"],
      ]);
      expect(await adminClient.assemblyItem.findMany({ where: { assemblyId: installed.id }, orderBy: { sortOrder: "asc" } })).toEqual(beforeRows);
      const input = { reviewToken: preview.reviewToken, componentMappings: [{ componentKey: "disposal", costItemId: haulItemA }] };
      await expect(inSession(ownerB, orgB, "owner", () => service.previewRecipeUpgrade(installed.id, orgB))).rejects.toThrow("not found");
      await expect(inSession(ownerB, orgB, "owner", () => service.confirmRecipeUpgrade(installed.id, orgB, input))).rejects.toThrow("not found");
      await expect(inSession(techA, orgA, "technician", () => service.confirmRecipeUpgrade(installed.id, orgA, input))).rejects.toThrow();
      await expect(inSession(ownerA, orgA, "owner", () => service.confirmRecipeUpgrade(installed.id, orgA, {
        ...input, componentMappings: [],
      }))).rejects.toThrow("mapping for each flagged component");
      await expect(inSession(ownerA, orgA, "owner", () => service.confirmRecipeUpgrade(installed.id, orgA, {
        ...input, componentMappings: [{ componentKey: "disposal", costItemId: itemB }],
      }))).rejects.toThrow("compatible Cost Item");

      await inSession(ownerA, orgA, "owner", () => prisma.assembly.update({
        where: { id: installed.id }, data: { productionRateFactor: 0.8 },
      }));
      await expect(inSession(ownerA, orgA, "owner", () => service.confirmRecipeUpgrade(installed.id, orgA, input))).rejects.toThrow("latest diff");
      const fresh = await inSession(ownerA, orgA, "owner", () => service.previewRecipeUpgrade(installed.id, orgA));
      const attempts = await Promise.allSettled([1, 2].map(() =>
        inSession(ownerA, orgA, "owner", () => service.confirmRecipeUpgrade(installed.id, orgA, { ...input, reviewToken: fresh.reviewToken })),
      ));
      expect(attempts.map(({ status }) => status).sort()).toEqual(["fulfilled", "rejected"]);
      expect(attempts.find(({ status }) => status === "fulfilled")).toMatchObject({ value: {
        installedRecipeVersion: 2, currentRecipeVersion: 2, updateAvailable: false,
        installedAt: installed.installedAt, wasteOverridePct: 10, productionRateFactor: 0.8,
      } });

      const rows = await adminClient.assemblyItem.findMany({ where: { assemblyId: installed.id }, orderBy: { sortOrder: "asc" } });
      expect(rows).toMatchObject([
        { id: beforeRows[0].id, recipeComponentKey: "excavation", costItemId: excavationItemA },
        { recipeComponentKey: "disposal", costItemId: haulItemA },
      ]);
      expect(rows.map((row) => Number(row.quantityPerUnit))).toEqual([2, 1]);
      expect(rows[1].id).not.toBe(beforeRows[1].id);
      expect(await adminClient.costItem.findMany({ where: costWhere, orderBy: { id: "asc" } })).toEqual(originalCostItems);
      expect(await adminClient.estimate.findUnique({ where: { id: estimate.id }, include: { lineItems: true } })).toEqual(estimate);

      const { history } = await inSession(techA, orgA, "technician", () => service.previewRecipeUpgrade(installed.id, orgA));
      expect(history).toMatchObject([{ assemblyId: installed.id, recipeId: recipe.id, fromVersion: 1, toVersion: 2, actorId: ownerA, upgradedAt: expect.any(Date) }]);
      expect(await inSession(ownerB, orgB, "owner", () => prisma.assemblyRecipeUpgrade.findMany({ where: { assemblyId: installed.id } }))).toEqual([]);
    } finally {
      lookup.mockRestore();
    }
  });

  it("stores install overrides on the assembly and prices with them, invisibly to other tenants (DEV-17 S10)", async () => {
    const materialId = "76000000-0000-0000-0000-000000000081";
    const laborRateId = "76000000-0000-0000-0000-000000000082";
    const deviceItemId = "76000000-0000-0000-0000-000000000083";
    const wireItemId = "76000000-0000-0000-0000-000000000084";
    const receptacleLaborItemId = "76000000-0000-0000-0000-000000000085";

    await inSession(ownerA, orgA, "owner", () => prisma.material.create({
      data: { id: materialId, orgId: orgA, name: "Duplex receptacle", unitOfMeasure: "EA", unitCost: 10, wasteFactorPct: 5 },
    }));
    await inSession(ownerA, orgA, "owner", () => prisma.laborRate.create({
      data: { id: laborRateId, orgId: orgA, role: "Electrician", trade: "Electrical", hourlyCost: 40, billRate: 60, baseHourlyRate: 40, burdenPct: 0 },
    }));
    await inSession(ownerA, orgA, "owner", () => prisma.costItem.createMany({ data: [
      { id: deviceItemId, orgId: orgA, subcategoryId: subA, code: "DEV-A", name: "Duplex device", unitOfMeasure: "EA", materialId },
      { id: wireItemId, orgId: orgA, subcategoryId: subA, code: "WIRE-A", name: "Box and wire allowance", unitOfMeasure: "EA" },
      { id: receptacleLaborItemId, orgId: orgA, subcategoryId: subA, code: "LAB-A", name: "Electrician labor", unitOfMeasure: "EA", productionRate: 10, laborRateId },
    ] }));

    const installed = await inSession(ownerA, orgA, "owner", () => service.installStarterCatalogAssembly({
      orgId: orgA,
      templateId: "receptacle",
      componentMappings: [
        { componentKey: "device", costItemId: deviceItemId },
        { componentKey: "box-wire", costItemId: wireItemId },
        { componentKey: "labor", costItemId: receptacleLaborItemId },
      ],
      wasteOverridePct: 15,
      productionRateFactor: 0.8,
    }));

    expect(installed.wasteOverridePct).toBe(15);
    expect(installed.productionRateFactor).toBe(0.8);

    const stored = await inSession(ownerA, orgA, "owner", () => prisma.assembly.findFirst({ where: { id: installed.id } }));
    expect(stored).not.toBeNull();
    expect(Number(stored!.wasteOverridePct)).toBe(15);
    expect(Number(stored!.productionRateFactor)).toBe(0.8);

    // Material $10 at the 15% override (not the mapped 5%) = $11.50;
    // labor 1/(10 x 0.8)h x $40 = $5.00; allowance $0.
    const priced = await inSession(ownerA, orgA, "owner", () => service.getAssemblyUnitCost(installed.id, undefined, new Set(), orgA));
    expect(priced.unitCost).toBeCloseTo(16.5, 2);

    const foreignView = await inSession(ownerB, orgB, "owner", () => prisma.assembly.findFirst({ where: { id: installed.id } }));
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

  it("reuses an installed assembly's mapping for a related recipe, and never exposes a foreign tenant's mapping (DEV-17 S9)", async () => {
    const equipmentForeign = "86000000-0000-0000-0000-000000000066";
    const itemForeign = "86000000-0000-0000-0000-000000000067";
    await inSession(ownerB, orgB, "owner", () => prisma.equipment.create({
      data: { id: equipmentForeign, orgId: orgB, name: "Foreign excavation crew" },
    }));
    await inSession(ownerB, orgB, "owner", () => prisma.costItem.create({
      data: { id: itemForeign, orgId: orgB, subcategoryId: subB, code: "EXC-B", name: "Foreign excavation", unitOfMeasure: "CY", equipmentId: equipmentForeign },
    }));
    // Assembly items carry no org column, so the source's rows are attached
    // by the admin client. The foreign item is deliberately first in
    // sort order: without the service's org filter it would win the
    // excavation slot.
    await adminClient.assemblyItem.createMany({ data: [
      { assemblyId: assemblyA, costItemId: itemForeign, quantityPerUnit: 1, sortOrder: 1 },
      { assemblyId: assemblyA, costItemId: excavationItemA, quantityPerUnit: 1, sortOrder: 2 },
      { assemblyId: assemblyA, costItemId: haulItemA, quantityPerUnit: 1, sortOrder: 3 },
    ] });

    const reused = await inSession(ownerA, orgA, "owner", () => service.suggestCatalogMappingReuse({
      orgId: orgA,
      templateId: "site-excavation",
      sourceAssemblyId: assemblyA,
    }));

    expect(reused.mappedCount).toBe(2);
    expect(reused.suggestions.map((suggestion) => suggestion.costItemId)).toEqual([excavationItemA, haulItemA]);
    expect(JSON.stringify(reused)).not.toContain(itemForeign);

    await expect(inSession(ownerB, orgB, "owner", () => service.suggestCatalogMappingReuse({
      orgId: orgB,
      templateId: "site-excavation",
      sourceAssemblyId: assemblyA,
    }))).rejects.toThrow("not found");
  });
});

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Costbook assembly integration tests`);
  return value;
}
