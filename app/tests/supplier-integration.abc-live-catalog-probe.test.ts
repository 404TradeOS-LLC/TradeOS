import { probeAbcSandboxCatalog, probeAbcSandboxCatalogPhase0, classifyProbeError } from "../scripts/probe-abc-sandbox-catalog";
import type { AbcCatalogItem, AbcCatalogPage, AbcCatalogRawItem, AbcCatalogRawPage } from "../modules/supplier-integration/abcCatalog";

function product(itemNumber: string): AbcCatalogItem {
  return {
    itemNumber, name: "Sensitive supplier product",
    familyId: null, familyName: null, manufacturer: null,
    isDimensional: false, uoms: [], dimensions: null, color: null, finish: null,
    variations: [], prop65Warnings: [], source: "ABC Supply", priceStatus: "unpriced",
  };
}

function page(pageNumber: number, totalPages: number, totalItems: number, items: AbcCatalogItem[]): AbcCatalogPage {
  return {
    items,
    pagination: { itemsPerPage: 25, pageNumber, totalItems, totalPages },
    source: "ABC Supply", environment: "sandbox",
    pricing: "not-requested", persisted: false,
  };
}

describe("read-only ABC sandbox Product API proof (#735)", () => {
  it("validates two real provider-shaped pages but returns only counts", async () => {
    const client = { list: jest.fn()
      .mockResolvedValueOnce(page(1, 3, 52, [product("SECRET-SKU-01")]))
      .mockResolvedValueOnce(page(2, 3, 52, [product("SECRET-SKU-02")])) };
    const summary = await probeAbcSandboxCatalog(client, { maxPages: 2, itemsPerPage: 25 });
    expect(client.list).toHaveBeenNthCalledWith(1, { pageNumber: 1, itemsPerPage: 25 });
    expect(client.list).toHaveBeenNthCalledWith(2, { pageNumber: 2, itemsPerPage: 25 });
    expect(summary).toMatchObject({
      status: "verified_sandbox_page", environment: "sandbox",
      productScope: "product.read", pagesVerified: 2,
      providerReportedTotalItems: 52, providerReportedTotalPages: 3,
      activeProductsReturned: 2, uniqueActiveProductIdentitiesChecked: 2,
      storedProducts: 0, providerPricingRequested: false,
    });
    expect(JSON.stringify(summary)).not.toContain("SECRET-SKU");
    expect(JSON.stringify(summary)).not.toContain("Sensitive supplier product");
  });

  it("stops after one page when the provider says there is only one", async () => {
    const client = { list: jest.fn().mockResolvedValue(page(1, 1, 1, [product("SINGLE")])) };
    expect((await probeAbcSandboxCatalog(client, { maxPages: 2 })).pagesVerified).toBe(1);
    expect(client.list).toHaveBeenCalledTimes(1);
  });

  it("rejects zero-count/empty first-page proof instead of claiming success", async () => {
    const client = { list: jest.fn().mockResolvedValue(page(1, 0, 0, [])) };
    await expect(probeAbcSandboxCatalog(client)).rejects.toThrow("catalog_probe_empty_first_page");
  });

  it("fails when second page changes provider-reported catalog size", async () => {
    const client = { list: jest.fn()
      .mockResolvedValueOnce(page(1, 3, 60, [product("A")]))
      .mockResolvedValueOnce(page(2, 3, 61, [product("B")])) };
    await expect(probeAbcSandboxCatalog(client, { maxPages: 2 }))
      .rejects.toThrow("catalog_probe_pagination_drift");
  });

  it("rejects duplicated active ABC identities across provider pages", async () => {
    const client = { list: jest.fn()
      .mockResolvedValueOnce(page(1, 2, 2, [product("DUP")]))
      .mockResolvedValueOnce(page(2, 2, 2, [product("DUP")])) };
    await expect(probeAbcSandboxCatalog(client, { maxPages: 2 }))
      .rejects.toThrow("catalog_probe_identity_or_pricing_mismatch");
  });

  it("rejects a misplaced priced product and invalid provider boundary", async () => {
    const priced = { ...product("P"), priceStatus: "priced" as "unpriced" };
    const client = { list: jest.fn().mockResolvedValue(page(1, 1, 1, [priced])) };
    await expect(probeAbcSandboxCatalog(client)).rejects.toThrow("catalog_probe_identity_or_pricing_mismatch");

    const invalid = { ...page(1, 1, 1, [product("GOOD")]), environment: "production" as "sandbox" };
    const other = { list: jest.fn().mockResolvedValue(invalid) };
    await expect(probeAbcSandboxCatalog(other)).rejects.toThrow("catalog_probe_contract_mismatch");
  });

  it("rejects unbounded scans before any provider/network work", async () => {
    const client = { list: jest.fn() };
    await expect(probeAbcSandboxCatalog(client, { maxPages: 3 as 2 })).rejects.toThrow("invalid_probe_bounds");
    await expect(probeAbcSandboxCatalog(client, { itemsPerPage: 1000 })).rejects.toThrow("invalid_probe_bounds");
    expect(client.list).not.toHaveBeenCalled();
  });
});

describe("Phase 0 ABC sandbox catalog census — three 1000-item pages (#735)", () => {
  const fullHierarchy = {
    productGroup: { code: "1000", label: "Steep Slope Products",
      category: { code: "13", label: "Steep Slope Roofing",
        productType: { code: "70", label: "Fiberglass Shingles",
          materialComposition: { code: "62", label: "Asphalt",
            warranty: { code: "143", label: "Dimensional Shingles",
              brandLine: { code: "3232", label: "GAF Timberline HD" },
            },
          },
        },
      },
    },
  };

  function raw(itemNumber: string, overrides: Record<string, unknown> = {}): AbcCatalogRawItem {
    return { itemNumber, status: "Active", ...overrides } as AbcCatalogRawItem;
  }

  function rawPage(pageNumber: number, totalPages: number, totalItems: number, items: AbcCatalogRawItem[]): AbcCatalogRawPage {
    return {
      items,
      pagination: { itemsPerPage: 1000, pageNumber, totalItems, totalPages },
      source: "ABC Supply", environment: "sandbox",
      pricing: "not-requested", persisted: false,
    };
  }

  function hierarchyPage() {
    return {
      hierarchies: [fullHierarchy],
      pagination: { itemsPerPage: 50, pageNumber: 1, totalPages: 2, totalItems: 62 },
      source: "ABC Supply" as const, environment: "sandbox" as const,
      pricing: "not-requested" as const, persisted: false as const,
    };
  }

  it("samples three 1000-item pages, times them, and returns counts/census only", async () => {
    const dimensional = raw("DIM-01", {
      isDimensional: true,
      itemDescription: "Sensitive product name",
      supplierName: "Sensitive manufacturer",
      uoms: [{ code: "BD", name: "Bundle", description: "stocking" }, { name: "Each" }],
      dimensions: {
        width: { value: "12", uom: "IN" }, thickness: { value: "1", uom: "IN" },
        height: { value: "36", uom: "IN" },
        variations: [{ size: "Length A", conversionFactor: 1 }],
      },
      hierarchy: fullHierarchy,
    });
    const plain = raw("PLAIN-02", { familyName: "Shingles" });
    const inactive = raw("OLD-03", { status: "Inactive" });
    const client = {
      listRaw: jest.fn()
        .mockResolvedValueOnce(rawPage(1, 3, 2500, [dimensional, plain]))
        .mockResolvedValueOnce(rawPage(2, 3, 2500, [inactive]))
        .mockResolvedValueOnce(rawPage(3, 3, 2500, [raw("PLAIN-04")])),
      listHierarchyRaw: jest.fn().mockResolvedValue(hierarchyPage()),
    };
    // Clock: page latencies 1200, 800, 1000 ms; hierarchy 50 ms.
    const ticks = [0, 1200, 1200, 2000, 2000, 3000, 3000, 3050];
    const summary = await probeAbcSandboxCatalogPhase0(client, { now: () => ticks.shift() as number });

    expect(client.listRaw).toHaveBeenNthCalledWith(1, { pageNumber: 1, itemsPerPage: 1000, familyItems: true });
    expect(client.listRaw).toHaveBeenNthCalledWith(2, { pageNumber: 2, itemsPerPage: 1000, familyItems: true });
    expect(client.listRaw).toHaveBeenNthCalledWith(3, { pageNumber: 3, itemsPerPage: 1000, familyItems: true });
    expect(client.listHierarchyRaw).toHaveBeenCalledWith(1, 50);
    expect(summary).toMatchObject({
      status: "verified_sandbox_phase0", environment: "sandbox",
      productScope: "product.read", pagesVerified: 3, itemsPerPage: 1000,
      providerReportedTotalItems: 2500, providerReportedTotalPages: 3,
      itemsSampled: 4, activeItemsReturned: 3, inactiveItemsReturned: 1,
      otherStatusItemsReturned: 0, uniqueItemIdentitiesChecked: 4,
      pageLatenciesMs: [1200, 800, 1000],
      pageLatencyP50Ms: 1000, pageLatencyP95Ms: 1200,
      hierarchyLatencyMs: 50, hierarchyTotalItems: 62, hierarchyTotalPages: 2,
      hierarchyPathsSampled: 1, priceKeysFound: 0,
      storedProducts: 0, providerPricingRequested: false,
      estimatedStorageBytesLow: 2500 * 2048, estimatedStorageBytesHigh: 2500 * 5120,
    });
    expect(summary.fieldCensus.itemDescription).toEqual({ populated: 1, total: 4 });
    expect(summary.fieldCensus.marketingDescription).toEqual({ populated: 0, total: 4 });
    expect(summary.fieldCensus.specifications).toEqual({ populated: 0, total: 4 });
    expect(summary.fieldCensus.images).toEqual({ populated: 0, total: 4 });
    expect(summary.uomCensus).toEqual({
      itemsWithUoms: 1, totalUomEntries: 2,
      entriesWithCode: 1, entriesWithName: 2, entriesWithDescription: 1,
    });
    expect(summary.dimensionalCensus).toEqual({
      dimensionalItems: 1, withDimensionVariations: 1, withWidthThicknessHeight: 1,
    });
    expect(summary.hierarchyCensus).toMatchObject({
      itemsWithHierarchy: 1, fullSixLevel: 1, partialHierarchy: 0,
      hierarchyShapeFindings: {},
      nestingOrder: "productGroup>category>productType>materialComposition>warranty>brandLine",
    });
    // No provider content escapes: no item numbers, names, or manufacturers.
    expect(JSON.stringify(summary)).not.toContain("DIM-01");
    expect(JSON.stringify(summary)).not.toContain("PLAIN-02");
    expect(JSON.stringify(summary)).not.toContain("Sensitive product name");
    expect(JSON.stringify(summary)).not.toContain("Sensitive manufacturer");
  });

  it("fails when provider totals drift, identities repeat, or a price key appears", async () => {
    const drifting = {
      listRaw: jest.fn()
        .mockResolvedValueOnce(rawPage(1, 3, 2500, [raw("A")]))
        .mockResolvedValueOnce(rawPage(2, 3, 2501, [raw("B")])),
      listHierarchyRaw: jest.fn().mockResolvedValue(hierarchyPage()),
    };
    await expect(probeAbcSandboxCatalogPhase0(drifting)).rejects.toThrow("catalog_probe_pagination_drift");

    const duplicated = {
      listRaw: jest.fn()
        .mockResolvedValueOnce(rawPage(1, 3, 2500, [raw("DUP")]))
        .mockResolvedValueOnce(rawPage(2, 3, 2500, [raw("DUP")])),
      listHierarchyRaw: jest.fn().mockResolvedValue(hierarchyPage()),
    };
    await expect(probeAbcSandboxCatalogPhase0(duplicated))
      .rejects.toThrow("catalog_probe_identity_or_pricing_mismatch");

    const priced = {
      listRaw: jest.fn()
        .mockResolvedValueOnce(rawPage(1, 1, 1, [raw("P", { unitPrice: 9.99 })])),
      listHierarchyRaw: jest.fn().mockResolvedValue(hierarchyPage()),
    };
    await expect(probeAbcSandboxCatalogPhase0(priced)).rejects.toThrow("catalog_probe_price_key_found");

    const nestedPriced = {
      listRaw: jest.fn()
        .mockResolvedValueOnce(rawPage(1, 1, 1, [raw("NP", { uoms: [{ code: "EA", unitPrice: 9.99 }] })])),
      listHierarchyRaw: jest.fn().mockResolvedValue(hierarchyPage()),
    };
    await expect(probeAbcSandboxCatalogPhase0(nestedPriced)).rejects.toThrow("catalog_probe_price_key_found");
  });

  it("fails closed when the provider reports fewer than three pages", async () => {
    const tiny = {
      listRaw: jest.fn()
        .mockResolvedValueOnce(rawPage(1, 1, 1500, [raw("ONLY-01"), raw("ONLY-02")])),
      listHierarchyRaw: jest.fn().mockResolvedValue(hierarchyPage()),
    };
    await expect(probeAbcSandboxCatalogPhase0(tiny)).rejects.toThrow("catalog_probe_insufficient_pages");
    expect(tiny.listHierarchyRaw).not.toHaveBeenCalled();
  });

  it("counts dimensional placeholders as absent measurements", async () => {
    const placeholder = raw("DIM-EMPTY", {
      isDimensional: true,
      dimensions: { width: { value: null }, thickness: { value: null }, height: {} },
    });
    const client = {
      listRaw: jest.fn()
        .mockResolvedValueOnce(rawPage(1, 3, 3000, [placeholder]))
        .mockResolvedValueOnce(rawPage(2, 3, 3000, [raw("P2")]))
        .mockResolvedValueOnce(rawPage(3, 3, 3000, [raw("P3")])),
      listHierarchyRaw: jest.fn().mockResolvedValue(hierarchyPage()),
    };
    const summary = await probeAbcSandboxCatalogPhase0(client, { now: () => 0 });
    expect(summary.dimensionalCensus).toEqual({
      dimensionalItems: 1, withDimensionVariations: 0, withWidthThicknessHeight: 0,
    });
  });

  it("records malformed hierarchy levels as census findings instead of failing", async () => {
    // Live run 45904451563 proved the old fail-closed behavior wrong: real
    // sandbox hierarchy levels can lack a code or label, and throwing away
    // the whole run discards the main-page numbers along with the finding.
    const brokenHierarchy = raw("H-01", {
      hierarchy: { productGroup: { code: "1000", category: { label: "No code" } } },
    });
    const client = {
      listRaw: jest.fn()
        .mockResolvedValueOnce(rawPage(1, 3, 3000, [brokenHierarchy]))
        .mockResolvedValueOnce(rawPage(2, 3, 3000, [raw("P2")]))
        .mockResolvedValueOnce(rawPage(3, 3, 3000, [raw("P3")])),
      listHierarchyRaw: jest.fn().mockResolvedValue(hierarchyPage()),
    };
    const summary = await probeAbcSandboxCatalogPhase0(client, { now: () => 0 });
    expect(summary.hierarchyCensus).toMatchObject({
      itemsWithHierarchy: 1, fullSixLevel: 0, partialHierarchy: 1,
      hierarchyShapeFindings: { "productGroup:missing-label": 1, "category:missing-code": 1 },
    });
    // Only level names and missing fields are recorded — never values.
    expect(JSON.stringify(summary)).not.toContain("No code");
  });

  it("records a non-object hierarchy level as a census finding and keeps the partial path", async () => {
    const stringLevel = raw("H-02", {
      hierarchy: { productGroup: { code: "1000", label: "Roofing", category: "invalid" } },
    });
    const client = {
      listRaw: jest.fn()
        .mockResolvedValueOnce(rawPage(1, 3, 3000, [stringLevel]))
        .mockResolvedValueOnce(rawPage(2, 3, 3000, [raw("P2")]))
        .mockResolvedValueOnce(rawPage(3, 3, 3000, [raw("P3")])),
      listHierarchyRaw: jest.fn().mockResolvedValue(hierarchyPage()),
    };
    const summary = await probeAbcSandboxCatalogPhase0(client, { now: () => 0 });
    expect(summary.hierarchyCensus).toMatchObject({
      itemsWithHierarchy: 1, fullSixLevel: 0, partialHierarchy: 1,
      hierarchyShapeFindings: { "category:not-object:string": 1 },
    });
    expect(JSON.stringify(summary)).not.toContain("invalid");

    // A genuinely absent deeper level is a partial path, not a failure.
    const partial = raw("H-03", {
      hierarchy: { productGroup: { code: "1000", label: "Roofing" } },
    });
    const partialClient = {
      listRaw: jest.fn()
        .mockResolvedValueOnce(rawPage(1, 3, 3000, [partial]))
        .mockResolvedValueOnce(rawPage(2, 3, 3000, [raw("P2")]))
        .mockResolvedValueOnce(rawPage(3, 3, 3000, [raw("P3")])),
      listHierarchyRaw: jest.fn().mockResolvedValue(hierarchyPage()),
    };
    const partialSummary = await probeAbcSandboxCatalogPhase0(partialClient, { now: () => 0 });
    expect(partialSummary.hierarchyCensus).toMatchObject({
      itemsWithHierarchy: 1, fullSixLevel: 0, partialHierarchy: 1,
      hierarchyShapeFindings: {},
    });
  });

  it("records malformed levels from the hierarchy page as findings instead of failing", async () => {
    // CodeRabbit on #1129: the strict listHierarchy() mapping would abort the
    // run on the same malformed data the census describes, so the probe reads
    // the hierarchy page raw and censuses it too (findings only).
    const malformedPage = {
      hierarchies: [
        { productGroup: { code: "1000", label: "Roofing", category: { code: "13" } } },
        "not-an-object",
      ],
      pagination: { itemsPerPage: 50, pageNumber: 1, totalPages: 2, totalItems: 62 },
      source: "ABC Supply" as const, environment: "sandbox" as const,
      pricing: "not-requested" as const, persisted: false as const,
    };
    const client = {
      listRaw: jest.fn()
        .mockResolvedValueOnce(rawPage(1, 3, 3000, [raw("P1")]))
        .mockResolvedValueOnce(rawPage(2, 3, 3000, [raw("P2")]))
        .mockResolvedValueOnce(rawPage(3, 3, 3000, [raw("P3")])),
      listHierarchyRaw: jest.fn().mockResolvedValue(malformedPage),
    };
    const summary = await probeAbcSandboxCatalogPhase0(client, { now: () => 0 });
    expect(summary.hierarchyPathsSampled).toBe(2);
    expect(summary.hierarchyCensus.hierarchyShapeFindings).toMatchObject({
      "category:missing-label": 1,
      "hierarchy:not-object:string": 1,
    });
  });
});

describe("probe failure classification (redacted codes only)", () => {
  it("passes known probe codes through", () => {
    expect(classifyProbeError(new Error("catalog_probe_pagination_drift")))
      .toBe("catalog_probe_pagination_drift");
  });

  it("maps client failures to distinct codes", () => {
    expect(classifyProbeError(new Error("ABC catalog provider denied request: HTTP 403")))
      .toBe("provider_denied");
    expect(classifyProbeError(new Error("ABC catalog provider request failed")))
      .toBe("provider_request_failed");
    expect(classifyProbeError(new Error("ABC catalog provider unavailable: HTTP 503")))
      .toBe("provider_unavailable_http_503");
    expect(classifyProbeError(new Error("something else"))).toBe("provider_or_schema_failure");
  });

  it("reports schema failures by field path and code, never values", () => {
    const zodLike = {
      issues: [
        { path: ["items", 412, "familyName"], code: "invalid_type", received: "SECRET-VALUE" },
        { path: ["pagination", "totalItems"], code: "invalid_type", received: 1 },
      ],
    };
    const code = classifyProbeError(zodLike);
    expect(code).toBe("schema_mismatch:items.412.familyName:invalid_type;pagination.totalItems:invalid_type");
    expect(code).not.toContain("SECRET-VALUE");
  });
});
