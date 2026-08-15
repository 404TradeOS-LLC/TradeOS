type SupplierPriceUpdateStatus = "pending" | "approved" | "rejected";

export interface EnqueuePriceUpdateInput {
  orgId: string;
  supplierId: string;
  materialId: string;
  proposedUnitCost: number;
  source?: string;
  requestedByJob?: string;
}

export interface ListQueueFilters {
  status?: SupplierPriceUpdateStatus;
  supplierId?: string;
  materialId?: string;
}

export interface SupplierPriceUpdateDTO {
  id: string;
  orgId: string;
  supplierId: string;
  materialId: string;
  currentUnitCost: number;
  proposedUnitCost: number;
  status: SupplierPriceUpdateStatus;
  source: string;
  requestedByJob: string | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

interface SupplierFeedQuote {
  materialId: string;
  proposedUnitCost: number;
}

export type SupplierFeedFetcher = (supplierId: string, orgId: string) => Promise<SupplierFeedQuote[]>;

export interface SyncFromFeedInput {
  orgId: string;
  supplierId: string;
  requestedByJob?: string;
}

export interface SyncFromFeedResult {
  proposed: number;
  skipped: number;
}

// One scheduled sync target: which org/supplier to check, and which
// identity (an existing user with an active membership in that org) the
// background job runs as. There is no cross-tenant "service account"
// concept in this app, so the scheduler is configured with an explicit
// list of targets rather than discovering organizations/suppliers itself —
// doing the latter would require a database connection that bypasses RLS,
// which background jobs are deliberately not given (see
// db/requestSession.ts's runWithBackgroundDatabaseSession).
export interface SupplierPriceSyncJobSpec {
  orgId: string;
  userId: string;
  supplierId: string;
  label?: string;
}

export interface SupplierPriceSyncJobOutcome {
  spec: SupplierPriceSyncJobSpec;
  result?: SyncFromFeedResult;
  error?: string;
}
