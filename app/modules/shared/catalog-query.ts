import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError } from "../../backend/middleware/errorHandler";

export const DEFAULT_CATALOG_PAGE_LIMIT = 25;
export const MAX_CATALOG_PAGE_LIMIT = 100;

export const catalogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_CATALOG_PAGE_LIMIT).optional(),
  cursor: z.string().trim().min(1).max(4096).optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.string().trim().min(1).max(40).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const catalogBooleanQuery = z.enum(["true", "false"]).transform((value) => value === "true");

export type CatalogOrder = "asc" | "desc";

export interface CatalogQuery {
  limit: number;
  cursor?: string;
  q?: string;
  sort: string;
  order: CatalogOrder;
  filters: Record<string, string | boolean | undefined>;
  scope?: string;
}

export interface CatalogPage<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}

interface CatalogCursor {
  v: 1;
  s: string;
  o: CatalogOrder;
  k: string;
  i: string;
  f: string;
}

export function parseCatalogQuery(
  raw: unknown,
  options: { defaultSort: string; allowedSorts: readonly string[]; filters?: Record<string, string | boolean | undefined> } = {
    defaultSort: "name",
    allowedSorts: ["name"],
  }
): CatalogQuery {
  const parsed = catalogQuerySchema.strict().parse(raw);
  const sort = parsed.sort ?? options.defaultSort;
  if (!options.allowedSorts.includes(sort)) {
    throw new ApiError(400, `Unsupported catalog sort field: ${sort}`);
  }

  return {
    limit: parsed.limit ?? DEFAULT_CATALOG_PAGE_LIMIT,
    cursor: parsed.cursor,
    q: parsed.q || undefined,
    sort,
    order: parsed.order ?? "asc",
    filters: options.filters ?? {},
  };
}

export function catalogFilterKey(query: CatalogQuery): string {
  const filters = Object.entries(query.filters)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return createHash("sha256")
    .update(JSON.stringify({ scope: query.scope ?? "", q: query.q ?? "", filters }))
    .digest("hex");
}

export function catalogCursorPredicate(
  query: CatalogQuery,
  field: string,
  valueType: "string" | "number" | "date"
): Record<string, unknown> | undefined {
  if (!query.cursor) return undefined;
  const cursor = decodeCatalogCursor(query.cursor);
  const filterKey = catalogFilterKey(query);
  if (cursor.s !== query.sort || cursor.o !== query.order || cursor.f !== filterKey) {
    throw new ApiError(400, "Pagination cursor does not match the requested catalog query");
  }

  const value = valueType === "date"
    ? new Date(cursor.k)
    : valueType === "number"
      ? Number(cursor.k)
      : cursor.k;
  if ((valueType === "date" && Number.isNaN((value as Date).getTime())) || (valueType === "number" && !Number.isFinite(value))) {
    throw new ApiError(400, "Invalid pagination cursor");
  }

  const operator = query.order === "asc" ? "gt" : "lt";
  return {
    OR: [
      { [field]: { [operator]: value } },
      { [field]: value, id: { [operator]: cursor.i } },
    ],
  };
}

export function encodeCatalogCursor(query: CatalogQuery, value: unknown, id: string): string {
  let key: string;
  if (value instanceof Date) key = value.toISOString();
  else if (typeof value === "string") key = value;
  else if (typeof value === "number" && Number.isFinite(value)) key = String(value);
  else throw new ApiError(500, "Catalog cursor cannot represent the selected sort value");

  const cursor: CatalogCursor = { v: 1, s: query.sort, o: query.order, k: key, i: id, f: catalogFilterKey(query) };
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCatalogCursor(value: string): CatalogCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<CatalogCursor>;
    if (
      parsed.v !== 1 ||
      typeof parsed.s !== "string" ||
      (parsed.o !== "asc" && parsed.o !== "desc") ||
      typeof parsed.k !== "string" ||
      typeof parsed.i !== "string" ||
      typeof parsed.f !== "string"
    ) throw new Error("invalid shape");
    return parsed as CatalogCursor;
  } catch {
    throw new ApiError(400, "Invalid pagination cursor");
  }
}

export async function pageCatalogRows<T>(options: {
  query: CatalogQuery;
  where: Record<string, unknown>;
  cursorField: string;
  cursorValueType: "string" | "number" | "date";
  findMany: (args: Record<string, unknown>) => Promise<T[]>;
  count: (args: Record<string, unknown>) => Promise<number>;
  getCursorValue: (row: T) => unknown;
  getId: (row: T) => string;
  map: (row: T) => T;
  include?: Record<string, unknown>;
}): Promise<CatalogPage<T>> {
  const cursorWhere = catalogCursorPredicate(options.query, options.cursorField, options.cursorValueType);
  const rowsPromise = options.findMany({
    where: cursorWhere ? { AND: [options.where, cursorWhere] } : options.where,
    orderBy: [{ [options.cursorField]: options.query.order }, { id: options.query.order }],
    take: options.query.limit + 1,
    ...(options.include ? options.include : {}),
  });
  const totalPromise = options.count({ where: options.where });
  const [rows, total] = await Promise.all([rowsPromise, totalPromise]);
  const hasMore = rows.length > options.query.limit;
  const pageRows = hasMore ? rows.slice(0, options.query.limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map(options.map),
    total,
    nextCursor: hasMore && last ? encodeCatalogCursor(options.query, options.getCursorValue(last), options.getId(last)) : null,
  };
}
