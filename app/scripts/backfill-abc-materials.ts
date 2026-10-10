import "dotenv/config";
import type { AuthContext } from "../backend/auth/context";
import { basePrisma, prisma } from "../db/client";
import { runWithBackgroundDatabaseSession } from "../db/requestSession";

/**
 * Backfills Material rows from seeded SupplierProduct rows so the ABC Supply
 * price-sync feed has materials to price.
 *
 * The feed's default material loader reads Material rows carrying the
 * supplier's id and the supplier item number in `sku`. The governed seed only
 * writes suppliers / supplier products / price observations, so the feed
 * short-circuits with zero materials until this linkage exists.
 *
 * Idempotent: materials are matched on (orgId, supplierId, sku). Re-running
 * never duplicates; existing rows keep human-set pricing (unitCost is only
 * filled when it is currently zero).
 */

interface CliArgs {
  orgId?: string;
  userId?: string;
  supplierKey: string;
  dryRun: boolean;
  limit: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let orgId: string | undefined;
  let userId: string | undefined;
  let supplierKey = "ABC_SUPPLY";
  let dryRun = false;
  let limit = 0;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--org-id") orgId = argv[i + 1];
    if (argv[i] === "--user-id") userId = argv[i + 1];
    if (argv[i] === "--supplier-key") supplierKey = argv[i + 1] ?? supplierKey;
    if (argv[i] === "--dry-run") dryRun = true;
    if (argv[i] === "--limit") limit = Number(argv[i + 1]);
  }

  if (!dryRun && (!orgId || !userId)) {
    throw new Error(
      "Usage: backfill-abc-materials.ts [--dry-run] --org-id <uuid> --user-id <uuid> [--supplier-key ABC_SUPPLY] [--limit N]"
    );
  }
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error("--limit must be a non-negative integer");
  }

  return { orgId, userId, supplierKey, dryRun, limit };
}

function requireCostbookManage(auth: AuthContext): void {
  if (!auth.permissions?.includes("costbook.manage")) {
    throw new Error(
      "ABC material backfill identity must have costbook.manage permission"
    );
  }
}

export interface BackfillProductInput {
  id: string;
  sku: string;
  name: string;
  purchaseUnit: string | null;
  manufacturerPartNumber: string | null;
  materialId: string | null;
}

export interface BackfillMaterialRow {
  name: string;
  unitOfMeasure: string;
  unitCost: number;
  sku: string;
}

/** Pure mapping: supplier product (+ latest observed price) -> material row. */
export function buildMaterialRow(
  product: BackfillProductInput,
  latestEffectivePrice: number | null
): BackfillMaterialRow {
  return {
    name: product.name,
    unitOfMeasure: product.purchaseUnit?.trim() || "EA",
    unitCost: latestEffectivePrice ?? 0,
    sku: product.sku.trim(),
  };
}

/**
 * Never clobber human pricing: only fill unitCost when the existing material
 * carries no price yet.
 */
export function shouldFillUnitCost(existingUnitCost: unknown): boolean {
  return Number(existingUnitCost ?? 0) === 0;
}

interface BackfillCounts {
  productsScanned: number;
  materialsCreated: number;
  materialsLinked: number;
  unitCostsFilled: number;
  productsLinked: number;
  skippedNoPrice: number;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { orgId, userId, supplierKey, dryRun, limit } = args;

  if (dryRun) {
    console.log(
      "[abc-backfill] DRY RUN — no writes. Pass --org-id/--user-id for a live run."
    );
  }

  const counts: BackfillCounts = {
    productsScanned: 0,
    materialsCreated: 0,
    materialsLinked: 0,
    unitCostsFilled: 0,
    productsLinked: 0,
    skippedNoPrice: 0,
  };

  await runWithBackgroundDatabaseSession(
    basePrisma,
    {
      jobName: "abc-material-backfill",
      orgId: orgId ?? "dry-run",
      userId: userId ?? "dry-run",
    },
    async (auth) => {
      if (!dryRun) requireCostbookManage(auth);

      const supplier = await prisma.supplier.findFirst({
        where: { orgId, apiIntegrationKey: supplierKey },
        select: { id: true, displayName: true },
      });
      if (!supplier) {
        throw new Error(
          `No supplier with apiIntegrationKey '${supplierKey}' in org ${orgId}`
        );
      }
      console.log(
        `[abc-backfill] supplier: ${supplier.displayName} (${supplier.id})`
      );

      const products = await prisma.supplierProduct.findMany({
        where: {
          orgId,
          supplierId: supplier.id,
          isActive: true,
          sku: { not: null },
        },
        select: {
          id: true,
          sku: true,
          name: true,
          purchaseUnit: true,
          manufacturerPartNumber: true,
          materialId: true,
        },
        orderBy: { id: "asc" },
        ...(limit > 0 ? { take: limit } : {}),
      });
      console.log(
        `[abc-backfill] ${products.length} active supplier products with SKUs`
      );

      for (const product of products) {
        const sku = product.sku?.trim();
        if (!sku) continue;
        counts.productsScanned += 1;

        const latest = await prisma.supplierPriceObservation.findFirst({
          where: {
            orgId,
            supplierProductId: product.id,
            effectivePrice: { not: null },
          },
          orderBy: { observedAt: "desc" },
          select: { effectivePrice: true },
        });
        const price =
          latest?.effectivePrice == null
            ? null
            : Number(latest.effectivePrice);
        if (price == null) counts.skippedNoPrice += 1;

        const row = buildMaterialRow(
          {
            id: product.id,
            sku,
            name: product.name,
            purchaseUnit: product.purchaseUnit,
            manufacturerPartNumber: product.manufacturerPartNumber,
            materialId: product.materialId,
          },
          price
        );

        if (dryRun) {
          console.log(
            `[abc-backfill] would upsert material sku=${row.sku} unit=${row.unitOfMeasure} cost=${row.unitCost}`
          );
          continue;
        }

        const existing = await prisma.material.findFirst({
          where: { orgId, supplierId: supplier.id, sku: row.sku },
          select: { id: true, unitCost: true, supplierId: true, sku: true },
        });

        let materialId: string;
        if (existing) {
          materialId = existing.id;
          counts.materialsLinked += 1;
          const data: Record<string, unknown> = {};
          if (!existing.supplierId) data.supplierId = supplier.id;
          if (!existing.sku) data.sku = row.sku;
          if (price != null && shouldFillUnitCost(existing.unitCost)) {
            data.unitCost = price;
            data.lastPriceUpdate = new Date();
            counts.unitCostsFilled += 1;
          }
          if (Object.keys(data).length > 0) {
            await prisma.material.update({ where: { id: materialId }, data });
          }
        } else {
          const created = await prisma.material.create({
            data: {
              orgId: orgId!,
              supplierId: supplier.id,
              sku: row.sku,
              name: row.name,
              unitOfMeasure: row.unitOfMeasure,
              unitCost: row.unitCost,
              wasteFactorPct: 0,
              lastPriceUpdate: new Date(),
            },
            select: { id: true },
          });
          materialId = created.id;
          counts.materialsCreated += 1;
        }

        if (!product.materialId) {
          await prisma.supplierProduct.update({
            where: { id: product.id },
            data: { materialId },
          });
          counts.productsLinked += 1;
        }
      }
    }
  );

  console.log(
    `[abc-backfill] done: scanned=${counts.productsScanned} ` +
      `created=${counts.materialsCreated} linked=${counts.materialsLinked} ` +
      `costsFilled=${counts.unitCostsFilled} productsLinked=${counts.productsLinked} ` +
      `noPrice=${counts.skippedNoPrice}`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[abc-backfill] FAILED:", error);
    process.exit(1);
  });
}
