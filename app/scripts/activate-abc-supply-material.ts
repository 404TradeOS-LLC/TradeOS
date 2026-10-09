import "dotenv/config";
import { Prisma } from "@prisma/client";
import { basePrisma, prisma } from "../db/client";
import { runWithBackgroundDatabaseSession } from "../db/requestSession";
import {
  parseAbcMaterialActivationArgs,
  validateAbcMaterialCandidate,
} from "../modules/supplier-integration/abcMaterialActivation";

/**
 * Activate exactly one explicitly reviewed ABC supplier product as an active
 * tenant Material so the existing sandbox sync can request a real quote.
 *
 * Preview (no writes):
 *   npm run costbook:activate-abc-material -- --org-id=<uuid> --user-id=<uuid> --product-key=<key>
 *
 * Apply (requires owner/admin and a separately approved initial unit cost):
 *   npm run costbook:activate-abc-material -- --org-id=<uuid> --user-id=<uuid> --product-key=<key> \
 *     --approved-unit-cost=<price> --confirm-sku=<exact-sku> --confirm-unit=<source-unit> \
 *     --confirmation=ACTIVATE_ONE_ABC_MATERIAL --apply
 *
 * Does not import bulk materials, approve supplier updates, change existing
 * prices, or turn a September 2026 source observation into a live ABC quote.
 */
export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const args = parseAbcMaterialActivationArgs(argv);

  const outcome = await runWithBackgroundDatabaseSession(basePrisma, {
    jobName: "abc-material-activation",
    orgId: args.orgId,
    userId: args.userId,
  }, async (actor) => {
    if (!["owner", "admin"].includes(actor.role) || !actor.permissions?.includes("costbook.manage")) {
      throw new Error("Only an active owner/admin with costbook.manage may activate ABC materials");
    }
    const supplier = await prisma.supplier.findFirst({
      where: { orgId: args.orgId, apiIntegrationKey: "ABC_SUPPLY" },
      select: { id: true, name: true },
    });
    if (!supplier) throw new Error("ABC_SUPPLY supplier is not available to this tenant");

    // Serialize pilot activations for one product key inside the tenant session.
    await prisma.$executeRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${`abc-material-activation:${args.orgId}:${args.productKey}`}, 0))
    `);

    const product = await prisma.supplierProduct.findFirst({
      where: {
        orgId: args.orgId,
        supplierId: supplier.id,
        supplierProductKey: args.productKey,
      },
      select: {
        id: true, name: true, sku: true, purchaseUnit: true,
        canonicalMaterialKey: true, isActive: true, materialId: true,
        sourceFile: true, supplierProductKey: true,
      },
    });
    if (!product) throw new Error("Exact ABC supplier product key was not found for this organization");

    const [matchingSupplierProductCount, matchingMaterialCount, observationCount] = await Promise.all([
      prisma.supplierProduct.count({
        where: { orgId: args.orgId, supplierId: supplier.id, sku: product.sku },
      }),
      prisma.material.count({
        where: { orgId: args.orgId, supplierId: supplier.id, sku: product.sku },
      }),
      prisma.supplierPriceObservation.count({
        where: { orgId: args.orgId, supplierProductId: product.id },
      }),
    ]);
    const { sku, unit } = validateAbcMaterialCandidate({
      name: product.name,
      sku: product.sku,
      purchaseUnit: product.purchaseUnit,
      canonicalMaterialKey: product.canonicalMaterialKey,
      isActive: product.isActive,
      materialId: product.materialId,
      matchingSupplierProductCount,
      matchingMaterialCount,
      observationCount,
    }, args);

    const preview = {
      status: args.apply ? "activated" : "dry-run",
      writes: args.apply,
      orgId: args.orgId,
      supplier: supplier.name,
      supplierProductKey: product.supplierProductKey,
      productName: product.name,
      sku,
      unit,
      canonicalMaterialKey: product.canonicalMaterialKey,
      sourceFile: product.sourceFile,
      observationCount,
      approvedInitialUnitCost: args.approvedUnitCost,
      liveAbcPricingVerified: false,
      pendingPriceApprovalRequired: true,
    };
    if (!args.apply) return preview;

    // This cost is an explicit owner/admin baseline, NOT copied from an
    // unapproved supplier observation. Later provider quotes still enter
    // SupplierPriceUpdate(status=pending) through the existing worker.
    const material = await prisma.material.create({
      data: {
        orgId: args.orgId,
        supplierId: supplier.id,
        sku,
        name: product.name,
        unitOfMeasure: unit,
        unitCost: args.approvedUnitCost!,
        isActive: true,
      },
      select: { id: true },
    });
    const linked = await prisma.supplierProduct.updateMany({
      where: {
        id: product.id, orgId: args.orgId,
        supplierId: supplier.id, materialId: null,
      },
      data: { materialId: material.id },
    });
    if (linked.count !== 1) {
      throw new Error("Supplier product changed during activation; rolling back Material creation");
    }

    await prisma.activityEvent.create({
      data: {
        orgId: args.orgId,
        entityType: "material",
        entityId: material.id,
        eventType: "costbook.abc_material_activated",
        title: "ABC Material activated for live-price review",
        actorUserId: actor.userId,
        metadataJson: {
          supplierId: supplier.id,
          supplierProductId: product.id,
          supplierProductKey: product.supplierProductKey,
          sku,
          unit,
          sourceFile: product.sourceFile,
          initialCostSource: "explicit-operator-approved-cost",
          approvedInitialUnitCost: args.approvedUnitCost,
          requiresPriceReview: true,
        },
      },
    });
    return { ...preview, materialId: material.id };
  });

  console.log(JSON.stringify(outcome));
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  /activate-abc-supply-material(\\.[cm]?[jt]s)?$/.test(process.argv[1]);
if (invokedDirectly) {
  main()
    .catch((error) => {
      console.error("[abc-material-activation] " + (error instanceof Error ? error.message : String(error)));
      process.exitCode = 1;
    })
    .finally(async () => { await basePrisma.$disconnect(); });
}
