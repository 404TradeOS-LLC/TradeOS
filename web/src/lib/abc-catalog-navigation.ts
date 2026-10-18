/**
 * Pass only the current ABC query context into product detail navigation.
 * The detail page replays one provider page on demand (no product attributes in
 * URLs, cookies, browser storage, or TradeOS's database).
 */
export type AbcCatalogSource = {
  page: number;
  q?: string;
  searchBy?: "itemDescription" | "itemNumber";
  familyId?: string;
};

export type AbcCatalogSourceSearchParams = {
  sourcePage?: string;
  q?: string;
  searchBy?: string;
  familyId?: string;
};

export function buildAbcCatalogProductHref(itemNumber: string, source: AbcCatalogSource): string {
  const params = new URLSearchParams({ sourcePage: String(source.page) });
  if (source.q) params.set("q", source.q);
  if (source.searchBy === "itemNumber") params.set("searchBy", "itemNumber");
  if (source.familyId) params.set("familyId", source.familyId);
  return "/costbook/abc-catalog/" + encodeURIComponent(itemNumber) + "?" + params.toString();
}

/** A missing/invalid provenance hint must never trigger an unbounded catalog scan. */
export function parseAbcCatalogSource(params: AbcCatalogSourceSearchParams): AbcCatalogSource | null {
  if (!params.sourcePage || !/^[1-9][0-9]{0,5}$/.test(params.sourcePage)) return null;
  const page = Number(params.sourcePage);
  if (!Number.isSafeInteger(page) || page > 100_000) return null;
  const q = params.q?.trim().slice(0, 120) || undefined;
  const familyId = params.familyId?.trim().slice(0, 120) || undefined;
  return {
    page, q, familyId,
    searchBy: params.searchBy === "itemNumber" ? "itemNumber" : "itemDescription",
  };
}
