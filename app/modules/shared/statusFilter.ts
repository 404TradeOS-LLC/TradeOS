/**
 * Expands a caller-requested set of canonical statuses into every raw stored
 * value that normalizes to one of them, using the module's legacy status
 * map (e.g. `legacyEstimateStatusMap`). Proposal/Invoice rows can still hold
 * legacy raw values (proposal rows store "rejected" for canonical
 * "declined") — a naive `status: { in: canonicalStatuses }` filter would
 * silently miss those rows. Canonical values are always included as-is since
 * new rows are written with them directly.
 */
export function expandCanonicalStatusFilter(canonicalStatuses: readonly string[], legacyStatusMap: Record<string, string>): string[] {
  const rawValues = new Set<string>(canonicalStatuses);
  for (const [legacyValue, canonicalValue] of Object.entries(legacyStatusMap)) {
    if (canonicalStatuses.includes(canonicalValue)) rawValues.add(legacyValue);
  }
  return Array.from(rawValues);
}
