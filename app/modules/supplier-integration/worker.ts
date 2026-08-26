import { basePrisma } from "../../db/client";
import { runWithBackgroundDatabaseSession } from "../../db/requestSession";
import { SupplierIntegrationService } from "./service";
import { SyncFromFeedResult } from "./types";

export interface RunSupplierPriceSyncJobInput {
  orgId: string;
  userId: string;
  supplierId: string;
}

// Entry point for a scheduler/cron consumer to run a supplier price sync.
// Not exposed over HTTP: like other background jobs in this app, it derives
// its database role from the worker identity's active membership rather
// than from an HTTP-authenticated request, and runs under its own
// app.session_source-tagged transaction (see db/requestSession.ts).
export async function runSupplierPriceSyncJob(
  input: RunSupplierPriceSyncJobInput,
  service: SupplierIntegrationService = new SupplierIntegrationService()
): Promise<SyncFromFeedResult> {
  return runWithBackgroundDatabaseSession(
    basePrisma,
    { jobName: "supplier-price-sync", orgId: input.orgId, userId: input.userId },
    () =>
      service.syncFromFeed({
        orgId: input.orgId,
        supplierId: input.supplierId,
        requestedByJob: "job:supplier-price-sync",
      })
  );
}
