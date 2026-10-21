jest.mock("../db/client", () => ({
  basePrisma: { $disconnect: jest.fn() },
  prisma: {
    supplier: { findFirst: jest.fn() },
    supplierProduct: { findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
    material: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  },
}));
jest.mock("../db/requestSession", () => ({
  runWithBackgroundDatabaseSession: jest.fn(async (_db, _input, callback) =>
    callback({ role: "owner", permissions: ["costbook.manage"] })),
}));
import { prisma } from "../db/client";
import { ABC_BACKFILL_BATCH_SIZE, main, nextCursor, parseArgs } from "../scripts/backfill-abc-materials";

const org = "6d9fbc90-e4db-45b5-b6c7-852def03695a";
const user = "b82a25c1-f27e-47de-a5bc-000000000001";
const base = ["--org-id", org, "--user-id", user];
const product = { id: "product-01", sku: "ABC", purchaseUnit: "SQ", materialId: null };
const supplierFind = prisma.supplier.findFirst as jest.Mock;
const productsFind = prisma.supplierProduct.findMany as jest.Mock;
const productsCount = prisma.supplierProduct.count as jest.Mock;
const productsUpdate = prisma.supplierProduct.updateMany as jest.Mock;
const materialsFind = prisma.material.findMany as jest.Mock;
const materialsCreate = prisma.material.create as jest.Mock;
const materialsUpdate = prisma.material.update as jest.Mock;
const materialsUpdateMany = prisma.material.updateMany as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  supplierFind.mockResolvedValue({ id: "supplier-1" });
  productsFind.mockImplementation(async (query) => query.orderBy
    ? (query.where.id?.gt ? [] : [product]) : [{ sku: "ABC" }]);
  productsCount.mockResolvedValue(0);
  productsUpdate.mockResolvedValue({ count: 1 });
  materialsFind.mockResolvedValue([{ id: "approved-material", unitOfMeasure: "SQ" }]);
});
describe("ABC linking operator", () => {
  it("requires tenant UUIDs and refuses malformed inputs", () => {
    expect(() => parseArgs(["--dry-run"])).toThrow();
    expect(parseArgs([...base, "--dry-run"]).dryRun).toBe(true);
    expect(() => parseArgs([...base, "--limit"])).toThrow();
    expect(() => parseArgs([...base, "--limit", "-2"])).toThrow();
    expect(() => parseArgs([...base, "--limit", "1.5"])).toThrow();
    expect(() => parseArgs([...base, "--supplier-key", "NOT_ABC"])).toThrow();
  });
  it("enforces cursor advancement and bounded pages", () => {
    expect(ABC_BACKFILL_BATCH_SIZE).toBeLessThanOrEqual(25);
    expect(nextCursor(["a", "b", "c"], undefined)).toBe("c");
    expect(nextCursor(["d", "e"], "c")).toBe("e");
    expect(nextCursor([], "e")).toBe("e");
    expect(() => nextCursor(["b"], "c")).toThrow();
  });
  it("previews eligible links without any writes or price promotion", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await main([...base, "--dry-run"]);
      expect(productsUpdate).not.toHaveBeenCalled();
      expect(materialsCreate).not.toHaveBeenCalled();
      expect(materialsUpdate).not.toHaveBeenCalled();
      expect(materialsUpdateMany).not.toHaveBeenCalled();
      expect(JSON.parse(String(spy.mock.lastCall?.[0]))).toMatchObject({
        writes: false, linked: 1, materialCreates: 0, materialPriceUpdates: 0,
      });
    } finally { spy.mockRestore(); }
  });
  it("links only the approved exact SKU and matching unit", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await main(base);
      expect(productsUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ orgId: org, materialId: null }),
        data: { materialId: "approved-material" },
      }));
      expect(materialsCreate).not.toHaveBeenCalled();
      expect(materialsUpdate).not.toHaveBeenCalled();
      expect(materialsUpdateMany).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
  it.each([
    ["blank SKU", { ...product, sku: " " }],
    ["missing unit", { ...product, purchaseUnit: null }],
    ["padded SKU", { ...product, sku: " ABC " }],
    ["padded unit", { ...product, purchaseUnit: " SQ " }],
    ["conflicting existing link", { ...product, materialId: "different-material" }],
  ])("skips %s", async (_reason, row) => {
    productsFind.mockImplementation(async (query) => query.orderBy
      ? (query.where.id?.gt ? [] : [row]) : [{ sku: "ABC" }]);
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    try { await main(base); expect(productsUpdate).not.toHaveBeenCalled(); }
    finally { spy.mockRestore(); }
  });
  it("rejects normalized duplicate supplier SKUs", async () => {
    productsFind.mockImplementation(async (query) => query.orderBy
      ? (query.where.id?.gt ? [] : [product]) : [{ sku: "ABC" }, { sku: " ABC " }]);
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    try { await main(base); expect(productsUpdate).not.toHaveBeenCalled(); }
    finally { spy.mockRestore(); }
  });
  it.each([
    ["no material", []],
    ["multiple materials", [{ id: "a", unitOfMeasure: "SQ" }, { id: "b", unitOfMeasure: "SQ" }]],
    ["mismatched unit", [{ id: "a", unitOfMeasure: "EA" }]],
  ])("skips %s", async (_reason, rows) => {
    materialsFind.mockResolvedValue(rows);
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    try { await main(base); expect(productsUpdate).not.toHaveBeenCalled(); }
    finally { spy.mockRestore(); }
  });
  it("refuses conflicting shared Material links", async () => {
    productsCount.mockResolvedValue(1);
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    try { await main(base); expect(productsUpdate).not.toHaveBeenCalled(); }
    finally { spy.mockRestore(); }
  });
  it("records a concurrent update race as a skipped conflict", async () => {
    productsUpdate.mockResolvedValue({ count: 0 });
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await main(base);
      expect(JSON.parse(String(spy.mock.lastCall?.[0]))).toMatchObject({
        skippedConflict: 1, linked: 0,
      });
    } finally { spy.mockRestore(); }
  });
});
