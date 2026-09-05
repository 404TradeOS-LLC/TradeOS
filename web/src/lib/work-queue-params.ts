import type { EstimateQueueParams, InvoiceQueueParams, ProposalQueueParams } from "./api";

// Pure query-string builders for the three organization work-queue reads
// (PR #251), split out of api.ts so they can be unit-tested directly. api.ts
// itself can't be imported by a plain `node --test` file: it starts with
// `import "server-only"` (which throws outside Next's server-component
// bundling condition) and `ApiClientError`'s parameter-property constructor
// isn't valid in Node's test-runner-native TypeScript type-stripping mode.
// This module has neither problem and imports nothing from api.ts at
/**
 * Builds query parameters for filtering and paginating the estimate queue.
 *
 * @param params - Estimate queue filters and pagination values
 * @returns Query parameters containing the provided estimate queue values
 */

export function buildEstimateQueueSearchParams(params: EstimateQueueParams): URLSearchParams {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.updatedAfter) query.set("updatedAfter", params.updatedAfter);
  if (params.updatedBefore) query.set("updatedBefore", params.updatedBefore);
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  return query;
}

/**
 * Builds search parameters for filtering and paginating the proposal queue.
 *
 * @param params - Proposal queue filters and pagination values
 * @returns The serialized proposal queue search parameters
 */
export function buildProposalQueueSearchParams(params: ProposalQueueParams): URLSearchParams {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.sent != null) query.set("sent", String(params.sent));
  if (params.viewed != null) query.set("viewed", String(params.viewed));
  if (params.unsigned != null) query.set("unsigned", String(params.unsigned));
  if (params.staleBefore) query.set("staleBefore", params.staleBefore);
  if (params.updatedAfter) query.set("updatedAfter", params.updatedAfter);
  if (params.updatedBefore) query.set("updatedBefore", params.updatedBefore);
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  return query;
}

/**
 * Builds query parameters for filtering and paginating the invoice work queue.
 *
 * @param params - Invoice status, payment flags, update-date bounds, and pagination values
 * @returns The populated invoice queue query parameters
 */
export function buildInvoiceQueueSearchParams(params: InvoiceQueueParams): URLSearchParams {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.sent != null) query.set("sent", String(params.sent));
  if (params.overdue != null) query.set("overdue", String(params.overdue));
  if (params.partiallyPaid != null) query.set("partiallyPaid", String(params.partiallyPaid));
  if (params.unpaid != null) query.set("unpaid", String(params.unpaid));
  if (params.updatedAfter) query.set("updatedAfter", params.updatedAfter);
  if (params.updatedBefore) query.set("updatedBefore", params.updatedBefore);
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  return query;
}
