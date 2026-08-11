// Pure query-building/derivation helpers for the Athena Trace Explorer page
// (web/src/app/(app)/athena/traces/page.tsx). Zero relative imports - see
// athena-state.ts's top-of-file comment for why that matters for testing.

export interface AthenaTraceFilterInput {
  traceId?: string;
  requestId?: string;
  executionId?: string;
  status?: string;
  toolId?: string;
  model?: string;
  provider?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
}

const FILTER_KEYS: (keyof AthenaTraceFilterInput)[] = [
  "traceId",
  "requestId",
  "executionId",
  "status",
  "toolId",
  "model",
  "provider",
  "actorUserId",
  "from",
  "to",
];

/**
 * True when at least one filter is set - used to choose between the
 * "no traces match these filters" and "no traces in this organization yet"
 * empty-state copy, matching the isFiltered pattern DispatchWorkQueueTable
 * already uses.
 */
export function isAthenaTraceFiltered(filters: AthenaTraceFilterInput): boolean {
  return FILTER_KEYS.some((key) => Boolean(filters[key]?.trim()));
}

/**
 * Builds a /athena/traces?... href preserving every current filter, with an
 * optional cursor override for "Next page" links (cursor pagination is
 * forward-only - see AthenaTraceSearchResult.nextCursor - so there is no
 * equivalent "Previous" href to build).
 */
export function buildAthenaTracesHref(filters: AthenaTraceFilterInput, cursor?: string | null): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value && value.trim()) params.set(key, value.trim());
  }
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return qs ? `/athena/traces?${qs}` : "/athena/traces";
}

const DATETIME_LOCAL_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/**
 * Converts an <input type="datetime-local"> value ("YYYY-MM-DDTHH:mm", no
 * timezone) into the full ISO-8601 UTC instant the backend's
 * `z.string().datetime()` schema requires. The value is interpreted as UTC
 * (the filter bar labels the fields "(UTC)" accordingly) rather than the
 * server process's local timezone, so results are reproducible regardless of
 * where this Next.js server happens to run.
 */
export function athenaDatetimeLocalToIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = DATETIME_LOCAL_PATTERN.exec(value.trim());
  if (!match) return undefined;
  const iso = `${match[1]}T${match[2]}:00.000Z`;
  return Number.isNaN(new Date(iso).getTime()) ? undefined : iso;
}

/** Inverse of athenaDatetimeLocalToIso, for pre-filling the filter bar from the current query string. */
export function athenaIsoToDatetimeLocal(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}
