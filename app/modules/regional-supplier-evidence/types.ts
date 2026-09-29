export interface RegionalSupplierProductInput {
  supplierProductKey: string;
  sku?: string | null;
  manufacturerPartNumber?: string | null;
  name: string;
  description?: string | null;
  packageDescription?: string | null;
  purchaseUnit?: string | null;
  packageQuantity?: number | null;
  productUrl?: string | null;
  canonicalMaterialKey?: string | null;
  materialId?: string | null;
  availabilityStatus?: "available" | "unavailable" | "unknown";
  isActive?: boolean;
  sourceFile?: string | null;
}

export interface RegionalSupplierPriceObservationInput {
  observationKey: string;
  supplierProductKey: string;
  marketCode?: string | null;
  storeName?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  observedAt: Date;
  sourceUrl?: string | null;
  sourceFile?: string | null;
  sourceRow?: number | null;
  currency?: string;
  priceStatus: "priced" | "unavailable" | "not-listed" | "needs-review";
  regularPrice?: number | null;
  salePrice?: number | null;
  rebatePrice?: number | null;
  effectivePrice?: number | null;
  purchaseUnit?: string | null;
  packageQuantity?: number | null;
  normalizedUnitPrice?: number | null;
  normalizedUnit?: string | null;
  eligibilityReason?: string | null;
  sourceConfidence?: "low" | "medium" | "high" | null;
}

export interface IngestRegionalSupplierEvidenceInput {
  orgId: string;
  supplierId: string;
  sourceFile?: string | null;
  products: RegionalSupplierProductInput[];
  observations: RegionalSupplierPriceObservationInput[];
}

export interface IngestRegionalSupplierEvidenceResult {
  productsUpserted: number;
  observationsUpserted: number;
  unavailableObservations: number;
}

export interface RegionalSupplierEvidenceListFilters {
  supplierId?: string;
  priceStatus?: "priced" | "unavailable" | "not-listed" | "needs-review";
  q?: string;
  limit?: number;
}

export interface RegionalSupplierEvidenceListItem {
  id: string;
  observationKey: string;
  supplierProductKey: string;
  supplierProductName: string;
  canonicalMaterialKey: string | null;
  supplierId: string;
  supplierName: string;
  marketCode: string | null;
  storeName: string | null;
  observedAt: Date;
  priceStatus: string;
  regularPrice: number | null;
  effectivePrice: number | null;
  normalizedUnitPrice: number | null;
  normalizedUnit: string | null;
  sourceFile: string | null;
  sourceRow: number | null;
}

export interface RegionalSupplierEvidenceSummary {
  totalObservations: number;
  priced: number;
  unavailable: number;
  notListed: number;
  needsReview: number;
  suppliers: number;
}
