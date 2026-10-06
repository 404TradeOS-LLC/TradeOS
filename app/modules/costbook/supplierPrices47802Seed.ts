import { SUPPLIER_PRICES_47802 } from "./supplierPrices47802";
import type {
  RegionalSupplierPriceObservationInput,
  RegionalSupplierProductInput,
} from "../regional-supplier-evidence/types";

export const SUPPLIER_PRICES_47802_SOURCE_FILE =
  "app/modules/costbook/supplierPrices47802.ts";
export const SUPPLIER_PRICES_47802_EXPECTED_ROWS = 3188;
export const SUPPLIER_PRICES_47802_ELIGIBILITY_REASON =
  "Verified Terre Haute 47802 retail baseline from PR #682; refresh before live quoting";

export interface SupplierPrice47802SeedSupplier {
  sourceName: string;
  supplierCode: string;
  displayName: string;
  website: string | null;
}

export interface SupplierPrice47802SeedBatch {
  supplier: SupplierPrice47802SeedSupplier;
  products: RegionalSupplierProductInput[];
  observations: RegionalSupplierPriceObservationInput[];
}

export const SUPPLIER_PRICES_47802_SUPPLIERS: readonly SupplierPrice47802SeedSupplier[] = [
  {
    sourceName: "ABCSupply",
    supplierCode: "ABC_SUPPLY",
    displayName: "ABC Supply",
    website: "https://www.abcsupply.com/",
  },
  {
    sourceName: "HomeDepot",
    supplierCode: "HOME_DEPOT",
    displayName: "Home Depot",
    website: "https://www.homedepot.com/",
  },
  {
    sourceName: "JonesAndSons",
    supplierCode: "JONES_AND_SONS",
    displayName: "Jones & Sons",
    website: null,
  },
  {
    sourceName: "Lowes",
    supplierCode: "LOWES",
    displayName: "Lowe's",
    website: "https://www.lowes.com/",
  },
  {
    sourceName: "Menards",
    supplierCode: "MENARDS",
    displayName: "Menards",
    website: "https://www.menards.com/",
  },
  {
    sourceName: "Niehaus",
    supplierCode: "NIEHAUS",
    displayName: "Niehaus",
    website: null,
  },
] as const;

const supplierBySourceName = new Map(
  SUPPLIER_PRICES_47802_SUPPLIERS.map((supplier) => [supplier.sourceName, supplier])
);

/**
 * Converts the checked-in 47802 evidence corpus into bounded inputs for the
 * existing RegionalSupplierEvidenceService. Source canonical keys intentionally
 * are not promoted during this seed. The governed Costbook matcher may auto-link
 * only identities it can prove from current product evidence; everything else
 * remains supplier evidence for human review.
 */
export function buildSupplierPrices47802SeedBatches(
  batchSize = 50
): SupplierPrice47802SeedBatch[] {
  if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 250) {
    throw new Error("batchSize must be an integer between 1 and 250");
  }
  if (SUPPLIER_PRICES_47802.length !== SUPPLIER_PRICES_47802_EXPECTED_ROWS) {
    throw new Error(
      `Expected ${SUPPLIER_PRICES_47802_EXPECTED_ROWS} 47802 supplier rows, found ${SUPPLIER_PRICES_47802.length}`
    );
  }

  const productKeys = new Set<string>();
  const observationKeys = new Set<string>();
  const rowsBySupplier = new Map<string, Array<{
    sourceRow: number;
    product: RegionalSupplierProductInput;
    observation: RegionalSupplierPriceObservationInput;
  }>>();

  SUPPLIER_PRICES_47802.forEach((row, index) => {
    const supplier = supplierBySourceName.get(row.supplier);
    if (!supplier || supplier.supplierCode !== row.supplierCode) {
      throw new Error(
        `Unknown or mismatched 47802 supplier ${row.supplier}/${row.supplierCode}`
      );
    }

    const scopedProductKey = `${row.supplierCode}:${row.productKey}`;
    if (productKeys.has(scopedProductKey)) {
      throw new Error(`Duplicate 47802 supplier product key ${scopedProductKey}`);
    }
    productKeys.add(scopedProductKey);

    const observationKey = `${row.supplierCode}:${row.productKey}:${row.observedAt}`;
    if (observationKeys.has(observationKey)) {
      throw new Error(`Duplicate 47802 observation key ${observationKey}`);
    }
    observationKeys.add(observationKey);

    const purchaseUnit = normalizeSourceUnit(row.unit);
    const sourceRow = index + 1;
    const product: RegionalSupplierProductInput = {
      supplierProductKey: row.productKey,
      sku: row.sku || null,
      name: row.productName,
      description: row.materialName || null,
      purchaseUnit,
      productUrl: row.sourceUrl || null,
      availabilityStatus: "available",
      isActive: true,
      sourceFile: SUPPLIER_PRICES_47802_SOURCE_FILE,
    };
    const observation: RegionalSupplierPriceObservationInput = {
      observationKey,
      supplierProductKey: row.productKey,
      marketCode: "47802",
      storeName: supplier.displayName,
      city: "Terre Haute",
      state: "IN",
      postalCode: "47802",
      observedAt: new Date(`${row.observedAt}T00:00:00.000Z`),
      sourceUrl: row.sourceUrl || null,
      sourceFile: SUPPLIER_PRICES_47802_SOURCE_FILE,
      sourceRow,
      currency: "USD",
      priceStatus: "priced",
      regularPrice: row.price,
      effectivePrice: row.price,
      purchaseUnit,
      normalizedUnitPrice: row.price,
      normalizedUnit: purchaseUnit,
      eligibilityReason: SUPPLIER_PRICES_47802_ELIGIBILITY_REASON,
      sourceConfidence: "high",
    };

    const supplierRows = rowsBySupplier.get(row.supplier) ?? [];
    supplierRows.push({ sourceRow, product, observation });
    rowsBySupplier.set(row.supplier, supplierRows);
  });

  const batches: SupplierPrice47802SeedBatch[] = [];
  for (const supplier of SUPPLIER_PRICES_47802_SUPPLIERS) {
    const rows = rowsBySupplier.get(supplier.sourceName) ?? [];
    if (rows.length === 0) {
      throw new Error(`47802 seed supplier ${supplier.sourceName} has no evidence rows`);
    }
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize);
      batches.push({
        supplier,
        products: batch.map((row) => row.product),
        observations: batch.map((row) => row.observation),
      });
    }
  }

  return batches;
}

export function normalizeSourceUnit(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("$/") ? trimmed.slice(2) : trimmed;
}
