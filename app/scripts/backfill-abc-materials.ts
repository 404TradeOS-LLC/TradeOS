import "dotenv/config";
import type { AuthContext } from "../backend/auth/context";
import { basePrisma, prisma } from "../db/client";
import { runWithBackgroundDatabaseSession } from "../db/requestSession";

/**
 * Conservatively link ABC supplier products to *existing approved* Materials.
 * NEVER create Materials or promote historical observation prices.
 * New Materials require the separately reviewed single-product activation path.
 * Cursor progression makes every bounded batch a separate tenant-scoped RLS session.
 */
export const ABC_BACKFILL_BATCH_SIZE = 25;
export interface CliArgs {
  orgId: string; userId: string; supplierKey: string; dryRun: boolean; limit: number;
}
export function parseArgs(argv: readonly string[]): CliArgs {
  let orgId = "", userId = "", supplierKey = "ABC_SUPPLY", dryRun = false, limit = 0;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--dry-run") { dryRun = true; continue; }
    if (!["--org-id", "--user-id", "--supplier-key", "--limit"].includes(flag)) {
      throw new Error(`Unrecognized argument: ${flag}`);
    }
    const value = argv[++i];
    if (!value || value.startsWith("-")) throw new Error(`Missing or invalid value for ${flag}`);
    if (flag === "--org-id") orgId = value;
    if (flag === "--user-id") userId = value;
    if (flag === "--supplier-key") supplierKey = value;
    if (flag === "--limit") limit = Number(value);
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(orgId) || !uuid.test(userId)) throw new Error("Valid --org-id and --user-id UUIDs are required in all modes");
  if (supplierKey !== "ABC_SUPPLY") throw new Error("Only the ABC_SUPPLY integration is eligible");
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error("--limit must be a non-negative integer");
  return { orgId, userId, supplierKey, dryRun, limit };
}
function requireCostbookManage(actor: AuthContext): void {
  if (!["owner", "admin"].includes(actor.role) || !actor.permissions?.includes("costbook.manage")) {
    throw new Error("ABC linking requires active owner/admin with costbook.manage");
  }
}
export interface BackfillProductInput {
  id: string; sku: string; name: string; purchaseUnit: string | null;
  manufacturerPartNumber: string | null; materialId: string | null;
}
export interface BackfillMaterialRow {
  name: string; unitOfMeasure: string; unitCost: number; sku: string;
}
/** Historical price is intentionally ignored: an observation is not approval. */
export function buildMaterialRow(product: BackfillProductInput, _historicalPrice: number | null): BackfillMaterialRow {
  return { name: product.name, unitOfMeasure: product.purchaseUnit?.trim() || "EA", unitCost: 0, sku: product.sku.trim() };
}
/** No bulk changes to Material.unitCost, including zero or null values. */
export function shouldFillUnitCost(_existingUnitCost: unknown): boolean { return false; }
export function nextCursor(ids: readonly string[], previous: string | undefined): string | undefined {
  if (ids.length === 0) return previous;
  const last = ids[ids.length - 1];
  if (previous && last <= previous) throw new Error("ABC backfill cursor did not advance");
  return last;
}
export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  let cursor: string | undefined;
  let scanned = 0, linked = 0, skippedUnapproved = 0, skippedDuplicate = 0, skippedConflict = 0;
  while (true) {
    const take = args.limit ? Math.min(ABC_BACKFILL_BATCH_SIZE, args.limit - scanned) : ABC_BACKFILL_BATCH_SIZE;
    if (take <= 0) break;
    const page = await runWithBackgroundDatabaseSession(basePrisma, {
      jobName: "abc-material-backfill", orgId: args.orgId, userId: args.userId,
    }, async (actor) => {
      requireCostbookManage(actor);
      const supplier = await prisma.supplier.findFirst({
        where: { orgId: args.orgId, apiIntegrationKey: args.supplierKey }, select: { id: true },
      });
      if (!supplier) throw new Error("ABC_SUPPLY supplier not found in the authorized organization");
      const products = await prisma.supplierProduct.findMany({
        where: { orgId: args.orgId, supplierId: supplier.id, isActive: true, sku: { not: null },
          ...(cursor ? { id: { gt: cursor } } : {}) },
        orderBy: { id: "asc" }, take,
        select: { id: true, sku: true, purchaseUnit: true, materialId: true },
      });
      let pageLinked = 0, pageUnapproved = 0, pageDuplicate = 0, pageConflict = 0;
      for (const product of products) {
        const sku = product.sku?.trim();
        const unit = product.purchaseUnit?.trim();
        if (!sku || !unit) { pageUnapproved++; continue; }
        const duplicates = await prisma.supplierProduct.count({
          where: { orgId: args.orgId, supplierId: supplier.id, sku },
        });
        if (duplicates !== 1) { pageDuplicate++; continue; }
        const matches = await prisma.material.findMany({
          where: { orgId: args.orgId, supplierId: supplier.id, sku, isActive: true },
          select: { id: true, unitOfMeasure: true }, take: 2,
        });
        if (matches.length !== 1 || matches[0].unitOfMeasure !== unit) { pageUnapproved++; continue; }
        const targetId = matches[0].id;
        if (product.materialId && product.materialId !== targetId) { pageConflict++; continue; }
        if (product.materialId === targetId) continue;
        if (!args.dryRun) {
          const result = await prisma.supplierProduct.updateMany({
            where: { id: product.id, orgId: args.orgId, supplierId: supplier.id, materialId: null },
            data: { materialId: targetId },
          });
          if (result.count !== 1) { pageConflict++; continue; }
        }
        pageLinked++;
      }
      return { ids: products.map(p => p.id), pageLinked, pageUnapproved, pageDuplicate, pageConflict };
    });
    cursor = nextCursor(page.ids, cursor);
    scanned += page.ids.length;
    linked += page.pageLinked;
    skippedUnapproved += page.pageUnapproved;
    skippedDuplicate += page.pageDuplicate;
    skippedConflict += page.pageConflict;
    if (page.ids.length < take) break;
  }
  console.log(JSON.stringify({ status: args.dryRun ? "dry-run" : "linked", writes: !args.dryRun,
    scanned, linked, skippedUnapproved, skippedDuplicate, skippedConflict,
    materialCreates: 0, materialPriceUpdates: 0, historicalPricePromotions: 0 }));
}
const directlyInvoked = typeof process.argv[1] === "string" && process.argv[1].includes("backfill-abc-materials");
if (directlyInvoked) {
  main().catch(e => { console.error("[abc-backfill]", e); process.exitCode = 1; })
    .finally(async () => { await basePrisma.$disconnect(); });
}
