import { ABC_BACKFILL_BATCH_SIZE, buildMaterialRow, nextCursor, parseArgs, shouldFillUnitCost } from "../scripts/backfill-abc-materials";

const org = "6d9fbc90-e4db-45b5-b6c7-852def03695a";
const user = "b82a25c1-f27e-47de-a5bc-000000000001";
const base = ["--org-id", org, "--user-id", user];
describe("ABC backfill safety", () => {
  const product = { id:"prod-1", sku:" 02BPEV4SC ", name:"Roofing Shingle", purchaseUnit:"BNDL", manufacturerPartNumber:null, materialId:null };
  it("never promotes historical observations into an approved price", () => {
    expect(buildMaterialRow(product, 44.47)).toEqual({name:"Roofing Shingle",unitOfMeasure:"BNDL",unitCost:0,sku:"02BPEV4SC"});
    expect(shouldFillUnitCost(0)).toBe(false);
    expect(shouldFillUnitCost(null)).toBe(false);
    expect(shouldFillUnitCost(44.47)).toBe(false);
  });
  it("requires real tenant IDs in dry-run mode", () => {
    expect(() => parseArgs(["--dry-run"])).toThrow();
    expect(parseArgs([...base,"--dry-run"]).dryRun).toBe(true);
  });
  it("rejects missing operands, unsupported suppliers, and invalid limits", () => {
    expect(() => parseArgs([...base,"--limit"])).toThrow();
    expect(() => parseArgs([...base,"--limit","-2"])).toThrow();
    expect(() => parseArgs([...base,"--limit","1.5"])).toThrow();
    expect(() => parseArgs([...base,"--supplier-key","NOT_ABC"])).toThrow();
  });
  it("bounds each batch and advances across pages", () => {
    expect(ABC_BACKFILL_BATCH_SIZE).toBeLessThanOrEqual(25);
    expect(nextCursor(["a","b","c"],undefined)).toBe("c");
    expect(nextCursor(["d","e"],"c")).toBe("e");
    expect(nextCursor([],"e")).toBe("e");
    expect(() => nextCursor(["b"],"c")).toThrow();
  });
});
