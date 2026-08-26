import { ApiError } from "../backend/middleware/errorHandler";
import {
  DEFAULT_CATALOG_PAGE_LIMIT,
  MAX_CATALOG_PAGE_LIMIT,
  catalogCursorPredicate,
  encodeCatalogCursor,
  pageCatalogRows,
  parseCatalogQuery,
} from "../modules/shared/catalog-query";

describe("Costbook catalog query contract", () => {
  const baseQuery = () => parseCatalogQuery({ limit: 2, sort: "name", order: "asc" }, {
    defaultSort: "name",
    allowedSorts: ["name", "createdAt"],
    filters: { active: true },
  });

  it("uses bounded defaults and rejects unsupported sort or oversized pages", () => {
    expect(parseCatalogQuery({}, { defaultSort: "name", allowedSorts: ["name"] })).toMatchObject({
      limit: DEFAULT_CATALOG_PAGE_LIMIT,
      sort: "name",
      order: "asc",
    });
    expect(MAX_CATALOG_PAGE_LIMIT).toBe(100);
    expect(() => parseCatalogQuery({ limit: 101 }, { defaultSort: "name", allowedSorts: ["name"] })).toThrow();
    expect(() => parseCatalogQuery({ sort: "arbitraryColumn" }, { defaultSort: "name", allowedSorts: ["name"] })).toThrow();
  });

  it("keeps page totals independent from the cursor predicate and uses an id tie-breaker", async () => {
    const query = baseQuery();
    const rows = [
      { id: "a", name: "Same" },
      { id: "b", name: "Same" },
      { id: "c", name: "Later" },
    ];
    const findMany = jest.fn(async (args: Record<string, unknown>) => {
      expect(args.orderBy).toEqual([{ name: "asc" }, { id: "asc" }]);
      return rows.slice(0, 3);
    });
    const count = jest.fn(async (args: Record<string, unknown>) => {
      expect(args.where).toEqual({ active: true });
      return 3;
    });

    const first = await pageCatalogRows({
      query,
      where: { active: true },
      cursorField: "name",
      cursorValueType: "string",
      findMany,
      count,
      getCursorValue: (row) => row.name,
      getId: (row) => row.id,
      map: (row) => row,
    });

    expect(first.items).toHaveLength(2);
    expect(first.total).toBe(3);
    expect(first.nextCursor).toBeTruthy();

    const secondQuery = { ...query, cursor: first.nextCursor as string };
    const secondPredicate = catalogCursorPredicate(secondQuery, "name", "string");
    expect(secondPredicate).toEqual({ OR: [{ name: { gt: "Same" } }, { name: "Same", id: { gt: "b" } }] });
  });

  it("fails closed for malformed or query-mismatched cursors", () => {
    const query = baseQuery();
    expect(() => catalogCursorPredicate({ ...query, cursor: "not-a-cursor" }, "name", "string")).toThrow(ApiError);
    const cursor = encodeCatalogCursor(query, "Same", "b");
    expect(() => catalogCursorPredicate({ ...query, q: "different", cursor }, "name", "string")).toThrow(ApiError);
    expect(() => catalogCursorPredicate({ ...query, scope: "other-org", cursor }, "name", "string")).toThrow(ApiError);
  });
});
