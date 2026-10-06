import "dotenv/config";
import { basePrisma, prisma } from "../db/client";
import { runWithBackgroundDatabaseSession } from "../db/requestSession";
import { RegionalSupplierEvidenceService } from "../modules/regional-supplier-evidence/service";
import {
  buildSupplierPrices47802SeedBatches,
  SUPPLIER_PRICES_47802_EXPECTED_ROWS,
  SUPPLIER_PRICES_47802_SOURCE_FILE,
  SUPPLIER_PRICES_47802_SUPPLIERS,
  type SupplierPrice47802SeedSupplier,
} from "../modules/costbook/supplierPrices47802Seed";

interface CliArgs {
  orgId: string;
  userId: string;
  batchSize: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let orgId: string | undefined;
  let userId: string | undefined;
  let batchSize = 50;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--org-id") orgId = argv[i + 1];
    if (argv[i] === "--user-id") userId = argv[i + 1];
    if (argv[i] === "--batch-size") batchSize = Number(argv[i + 1]);
  }

  if (!orgId || !userId) {
    throw new Error(
      "Usage: seed-supplier-prices-47802.ts --org-id <uuid> --user-id <uuid> [--batch-size 50]"
    );
  }
  if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 250) {
    throw new Error("--batch-size must be an integer between 1 and 250");
  }

  return { orgId, userId, batchSize };
}

async function ensureSupplier(
  orgId: string,
  supplier: SupplierPrice47802SeedSupplier
): Promise<string> {
  const existing = await prisma.supplier.findFirst({
    where: { orgId, name: supplier.displayName },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.supplier.create({
    data: {
      orgId,
      name: supplier.displayName,
      website: supplier.website,
    },
    select: { id: true },
  });
  return created.id;
}

async function main() {
  const { orgId, userId, batchSize } = parseArgs(process.argv.slice(2));
  const batches = buildSupplierPrices47802SeedBatches(batchSize);
  const supplierIds = new Map<string, string>();
  const service = new RegionalSupplierEvidenceService();

  for (const supplier of SUPPLIER_PRICES_47802_SUPPLIERS) {
    const supplierId = await runWithBackgroundDatabaseSession(
      basePrisma,
      {
        jobName: "costbook-supplier-seed-47802",
        orgId,
        userId,
      },
      () => ensureSupplier(orgId, supplier)
    );
    supplierIds.set(supplier.sourceName, supplierId);
    console.log(
      `[costbook-47802] supplier ${supplier.displayName}: ${supplierId}`
    );
  }

  let productsProcessed = 0;
  let observationsProcessed = 0;

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const supplierId = supplierIds.get(batch.supplier.sourceName);
    if (!supplierId) {
      throw new Error(`Missing seeded supplier ID for ${batch.supplier.sourceName}`);
    }

    const result = await runWithBackgroundDatabaseSession(
      basePrisma,
      {
        jobName: "costbook-supplier-seed-47802",
        orgId,
        userId,
      },
      () => service.ingest({
        orgId,
        supplierId,
        sourceFile: SUPPLIER_PRICES_47802_SOURCE_FILE,
        products: batch.products,
        observations: batch.observations,
      })
    );

    productsProcessed += result.productsUpserted;
    observationsProcessed += result.observationsUpserted;
    console.log(
      `[costbook-47802] batch ${index + 1}/${batches.length} ` +
      `${batch.supplier.displayName}: ${result.productsUpserted} products, ` +
      `${result.observationsUpserted} observations`
    );
  }

  const verification = await runWithBackgroundDatabaseSession(
    basePrisma,
    {
      jobName: "costbook-supplier-seed-47802-verify",
      orgId,
      userId,
    },
    async () => {
      const suppliers = await prisma.supplier.findMany({
        where: {
          orgId,
          name: { in: SUPPLIER_PRICES_47802_SUPPLIERS.map((supplier) => supplier.displayName) },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const products = await prisma.supplierProduct.count({
        where: { orgId, sourceFile: SUPPLIER_PRICES_47802_SOURCE_FILE },
      });
      const observations = await prisma.supplierPriceObservation.count({
        where: { orgId, sourceFile: SUPPLIER_PRICES_47802_SOURCE_FILE },
      });
      return { suppliers, products, observations };
    }
  );

  if (verification.suppliers.length !== SUPPLIER_PRICES_47802_SUPPLIERS.length) {
    throw new Error(
      `Seed verification expected ${SUPPLIER_PRICES_47802_SUPPLIERS.length} suppliers, found ${verification.suppliers.length}`
    );
  }
  if (verification.products !== SUPPLIER_PRICES_47802_EXPECTED_ROWS) {
    throw new Error(
      `Seed verification expected ${SUPPLIER_PRICES_47802_EXPECTED_ROWS} source products, found ${verification.products}`
    );
  }
  if (verification.observations !== SUPPLIER_PRICES_47802_EXPECTED_ROWS) {
    throw new Error(
      `Seed verification expected ${SUPPLIER_PRICES_47802_EXPECTED_ROWS} source observations, found ${verification.observations}`
    );
  }

  const abcSupply = verification.suppliers.find((supplier) => supplier.name === "ABC Supply");
  if (!abcSupply) throw new Error("ABC Supply supplier was not created or resolved");

  console.log(JSON.stringify({
    status: "verified",
    orgId,
    supplierCount: verification.suppliers.length,
    products: verification.products,
    observations: verification.observations,
    productsProcessed,
    observationsProcessed,
    abcSupplySupplierId: abcSupply.id,
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
