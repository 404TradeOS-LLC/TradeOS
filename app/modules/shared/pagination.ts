import { ApiError } from "../../backend/middleware/errorHandler";

export const DEFAULT_QUEUE_PAGE_LIMIT = 25;
export const MAX_QUEUE_PAGE_LIMIT = 50;

export interface UpdatedAtCursor {
  updatedAt: Date;
  id: string;
}

/**
 * Opaque, self-describing cursor for newest-activity-first (updatedAt desc,
 * id desc) keyset pagination shared by the organization work-queue reads.
 * Self-describing (base64url JSON) rather than a stored-row lookup: no extra
 * query to resolve it, and a malformed value fails closed instead of the
 * lookup-miss "fail open to page 1" behavior used elsewhere in this codebase
 * (athena-observability's trace search) — this queue's contract requires
 * invalid cursors to 400, never a silent restart.
 */
export function encodeUpdatedAtCursor(cursor: UpdatedAtCursor): string {
  return Buffer.from(JSON.stringify({ u: cursor.updatedAt.toISOString(), i: cursor.id }), "utf8").toString("base64url");
}

export function decodeUpdatedAtCursor(raw: string): UpdatedAtCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as Record<string, unknown>).u === "string" &&
      typeof (parsed as Record<string, unknown>).i === "string" &&
      (parsed as Record<string, unknown>).i !== ""
    ) {
      const updatedAt = new Date((parsed as { u: string }).u);
      if (!Number.isNaN(updatedAt.getTime())) {
        return { updatedAt, id: (parsed as { i: string }).i };
      }
    }
  } catch {
    // fall through to the shared 400 below
  }
  throw new ApiError(400, "Invalid pagination cursor");
}

export function clampQueueLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_QUEUE_PAGE_LIMIT;
  return Math.min(Math.max(Math.trunc(value), 1), MAX_QUEUE_PAGE_LIMIT);
}

/** Shared response envelope for every organization work-queue read. */
export interface QueuePage<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}

export interface DateRangeFilter {
  updatedAfter?: string;
  updatedBefore?: string;
}

export function buildUpdatedAtRange(filters: DateRangeFilter): { gte?: Date; lte?: Date } | undefined {
  const range: { gte?: Date; lte?: Date } = {};
  if (filters.updatedAfter) range.gte = new Date(filters.updatedAfter);
  if (filters.updatedBefore) range.lte = new Date(filters.updatedBefore);
  return Object.keys(range).length > 0 ? range : undefined;
}
