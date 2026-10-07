const mockPrisma = {
  supplier: { findFirst: jest.fn() },
  material: { findMany: jest.fn() },
  $queryRaw: jest.fn(async () => [{ refresh_token: null }]),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { fetchConfiguredSupplierFeed, createDefaultSupplierFeedFetcher } from "../modules/supplier-integration/feed";
import type { SupplierFeedFetcher } from "../modules/supplier-integration/types";

const supplierId = "11111111-1111-4111-8111-111111111111";
const materialId = "22222222-2222-4222-8222-222222222222";
const orgId = "33333333-3333-4333-8333-333333333333";
const originalEnv = process.env.SUPPLIER_PRICE_FEED_ENDPOINTS;
const originalFetch = global.fetch;

function response(body: unknown, options: { status?: number; contentLength?: string } = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    status: options.status ?? 200,
    headers: options.contentLength ? { "content-length": options.contentLength } : undefined,
  });
}

describe("configured supplier price feed", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    if (originalEnv === undefined) delete process.env.SUPPLIER_PRICE_FEED_ENDPOINTS;
    else process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = originalEnv;
    global.fetch = originalFetch;
  });

  it("is a safe no-op when no operator endpoint mapping exists", async () => {
    delete process.env.SUPPLIER_PRICE_FEED_ENDPOINTS;
    expect(await fetchConfiguredSupplierFeed(supplierId, orgId)).toEqual([]);
    expect(mockPrisma.supplier.findFirst).not.toHaveBeenCalled();
  });

  it("rejects non-HTTPS configured endpoints", async () => {
    process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = JSON.stringify({ [supplierId]: "http://example.test/prices" });
    await expect(fetchConfiguredSupplierFeed(supplierId, orgId)).rejects.toThrow("must use HTTPS");
  });

  it("scopes the supplier credential lookup to the active organization", async () => {
    process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = JSON.stringify({ [supplierId]: "https://supplier.example/prices" });
    mockPrisma.supplier.findFirst.mockResolvedValue(null);

    await expect(fetchConfiguredSupplierFeed(supplierId, orgId)).rejects.toThrow("not visible");
    expect(mockPrisma.supplier.findFirst).toHaveBeenCalledWith({
      where: { id: supplierId, orgId },
      select: { id: true, apiIntegrationKey: true },
    });
    expect(global.fetch).toBe(originalFetch);
  });

  it("fetches a strict quote payload with the supplier bearer key", async () => {
    process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = JSON.stringify({ [supplierId]: "https://supplier.example/prices" });
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: supplierId, apiIntegrationKey: "secret-key" });
    global.fetch = jest.fn().mockResolvedValue(response({ quotes: [{ materialId, proposedUnitCost: 12.34 }] }));

    await expect(fetchConfiguredSupplierFeed(supplierId, orgId)).resolves.toEqual([{ materialId, proposedUnitCost: 12.34 }]);
    expect(global.fetch).toHaveBeenCalledWith(
      new URL("https://supplier.example/prices"),
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        headers: expect.objectContaining({ authorization: "Bearer secret-key", accept: "application/json" }),
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("rejects malformed feed rows instead of enqueueing ambiguous data", async () => {
    process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = JSON.stringify({ [supplierId]: "https://supplier.example/prices" });
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: supplierId, apiIntegrationKey: null });
    global.fetch = jest.fn().mockResolvedValue(response({ quotes: [{ materialId: "not-a-uuid", proposedUnitCost: -1 }] }));

    await expect(fetchConfiguredSupplierFeed(supplierId, orgId)).rejects.toBeTruthy();
  });

  it("rejects upstream HTTP failures", async () => {
    process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = JSON.stringify({ [supplierId]: "https://supplier.example/prices" });
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: supplierId, apiIntegrationKey: null });
    global.fetch = jest.fn().mockResolvedValue(response("unavailable", { status: 503 }));

    await expect(fetchConfiguredSupplierFeed(supplierId, orgId)).rejects.toThrow("HTTP 503");
  });

  it("aborts a supplier feed that exceeds the timeout", async () => {
    jest.useFakeTimers();
    process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = JSON.stringify({ [supplierId]: "https://supplier.example/prices" });
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: supplierId, apiIntegrationKey: null });
    global.fetch = jest.fn().mockImplementation((_url: URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("supplier feed aborted")), { once: true });
    })) as typeof fetch;

    const request = fetchConfiguredSupplierFeed(supplierId, orgId);
    const rejection = expect(request).rejects.toThrow("supplier feed aborted");
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(15_000);
    await rejection;
  });

  it("rejects oversized responses from content-length before reading", async () => {
    process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = JSON.stringify({ [supplierId]: "https://supplier.example/prices" });
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: supplierId, apiIntegrationKey: null });
    global.fetch = jest.fn().mockResolvedValue(response("{}", { contentLength: "2000001" }));

    await expect(fetchConfiguredSupplierFeed(supplierId, orgId)).rejects.toThrow("size limit");
  });

  it("cancels a chunked response that exceeds the size limit without content-length", async () => {
    process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = JSON.stringify({ [supplierId]: "https://supplier.example/prices" });
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: supplierId, apiIntegrationKey: null });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(1_100_000));
        controller.enqueue(new Uint8Array(1_100_000));
        controller.close();
      },
    });
    global.fetch = jest.fn().mockResolvedValue(new Response(stream));

    await expect(fetchConfiguredSupplierFeed(supplierId, orgId)).rejects.toThrow("size limit");
  });
});

describe("default supplier price feed (ABC routing)", () => {
  const abcSupplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherSupplierId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const originalAbcSupplierId = process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID;
  const originalEndpoints = process.env.SUPPLIER_PRICE_FEED_ENDPOINTS;
  const abcSecretEnvKeys = [
    "ABC_SUPPLY_SANDBOX_CLIENT_ID",
    "ABC_SUPPLY_SANDBOX_CLIENT_SECRET",
    "ABC_SUPPLY_SANDBOX_REFRESH_TOKEN",
    "ABC_SUPPLY_BRANCH_NUMBER",
    "ABC_SUPPLY_SHIP_TO_NUMBER",
  ];
  const originalAbcSecrets: Record<string, string | undefined> = Object.fromEntries(
    abcSecretEnvKeys.map((k) => [k, process.env[k]]),
  );

  afterEach(() => {
    if (originalAbcSupplierId === undefined) delete process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID;
    else process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID = originalAbcSupplierId;
    if (originalEndpoints === undefined) delete process.env.SUPPLIER_PRICE_FEED_ENDPOINTS;
    else process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = originalEndpoints;
    for (const k of abcSecretEnvKeys) {
      if (originalAbcSecrets[k] === undefined) delete process.env[k];
      else process.env[k] = originalAbcSecrets[k] as string;
    }
    jest.useRealTimers();
  });

  it("routes the configured ABC supplier to the ABC fetcher", async () => {
    process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID = abcSupplierId;
    delete process.env.SUPPLIER_PRICE_FEED_ENDPOINTS;
    const abcFetcher: SupplierFeedFetcher = jest.fn(async () => [
      { materialId, proposedUnitCost: 12.5 },
    ]);
    const fetcher = createDefaultSupplierFeedFetcher({ abcFetcher });
    await expect(fetcher(abcSupplierId, orgId)).resolves.toEqual([
      { materialId, proposedUnitCost: 12.5 },
    ]);
    expect(abcFetcher).toHaveBeenCalledWith(abcSupplierId, orgId);
  });

  it("falls back to the configured-endpoint fetcher for other suppliers", async () => {
    process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID = abcSupplierId;
    delete process.env.SUPPLIER_PRICE_FEED_ENDPOINTS;
    const abcFetcher: SupplierFeedFetcher = jest.fn(async () => [
      { materialId, proposedUnitCost: 12.5 },
    ]);
    const fetcher = createDefaultSupplierFeedFetcher({ abcFetcher });
    await expect(fetcher(otherSupplierId, orgId)).resolves.toEqual([]);
    expect(abcFetcher).not.toHaveBeenCalled();
  });

  it("falls back when ABC_SUPPLY_SANDBOX_SUPPLIER_ID is not set", async () => {
    delete process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID;
    delete process.env.SUPPLIER_PRICE_FEED_ENDPOINTS;
    const abcFetcher: SupplierFeedFetcher = jest.fn(async () => [
      { materialId, proposedUnitCost: 12.5 },
    ]);
    const fetcher = createDefaultSupplierFeedFetcher({ abcFetcher });
    await expect(fetcher(abcSupplierId, orgId)).resolves.toEqual([]);
    expect(abcFetcher).not.toHaveBeenCalled();
  });

  it("loads the durable ABC refresh token and persists a rotation before pricing", async () => {
    process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID = abcSupplierId;
    process.env.ABC_SUPPLY_SANDBOX_CLIENT_ID = "cid";
    process.env.ABC_SUPPLY_SANDBOX_CLIENT_SECRET = "csecret";
    process.env.ABC_SUPPLY_SANDBOX_REFRESH_TOKEN = "env-bootstrap-token";
    process.env.ABC_SUPPLY_BRANCH_NUMBER = "340";
    process.env.ABC_SUPPLY_SHIP_TO_NUMBER = "2010466-2";
    delete process.env.SUPPLIER_PRICE_FEED_ENDPOINTS;

    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ refresh_token: "vault-refresh-token" }])
      .mockResolvedValueOnce([{ put_abc_supply_refresh_token: null }]);
    mockPrisma.material.findMany.mockResolvedValue([{ id: materialId, sku: "SKU-1" }]);

    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      const target = String(url);
      calls.push(target);
      if (target.includes("/v1/token")) {
        expect(String(init?.body)).toContain("refresh_token=vault-refresh-token");
        return response({
          access_token: "abc-access-token",
          expires_in: 1800,
          refresh_token: "rotated-refresh-token",
        });
      }
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer abc-access-token");
      return response({
        requestId: "price-1",
        lines: [{
          id: "line-0",
          itemNumber: "SKU-1",
          unitPrice: 42.5,
          currency: { code: "USD", symbol: "$" },
          status: { code: "OK", message: "Priced Successfully" },
        }],
      });
    }) as typeof fetch;

    const fetcher = createDefaultSupplierFeedFetcher();
    await expect(fetcher(abcSupplierId, orgId)).resolves.toEqual([
      { materialId, proposedUnitCost: 42.5 },
    ]);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(calls).toHaveLength(2);
  });

  it("fails before pricing when a rotated ABC refresh token cannot be persisted", async () => {
    process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID = abcSupplierId;
    process.env.ABC_SUPPLY_SANDBOX_CLIENT_ID = "cid";
    process.env.ABC_SUPPLY_SANDBOX_CLIENT_SECRET = "csecret";
    process.env.ABC_SUPPLY_SANDBOX_REFRESH_TOKEN = "env-bootstrap-token";
    process.env.ABC_SUPPLY_BRANCH_NUMBER = "340";
    process.env.ABC_SUPPLY_SHIP_TO_NUMBER = "2010466-2";
    delete process.env.SUPPLIER_PRICE_FEED_ENDPOINTS;

    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ refresh_token: "vault-refresh-token" }])
      .mockRejectedValueOnce(new Error("vault persistence unavailable"));
    mockPrisma.material.findMany.mockResolvedValue([{ id: materialId, sku: "SKU-1" }]);

    global.fetch = jest.fn(async (url: string | URL) => {
      if (String(url).includes("/v1/token")) {
        return response({
          access_token: "abc-access-token",
          expires_in: 1800,
          refresh_token: "rotated-refresh-token",
        });
      }
      throw new Error("pricing request must not run when token persistence fails");
    }) as typeof fetch;

    const fetcher = createDefaultSupplierFeedFetcher();
    await expect(fetcher(abcSupplierId, orgId)).rejects.toThrow("vault persistence unavailable");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("aborts a stalled ABC sandbox request at the feed deadline", async () => {
    process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID = abcSupplierId;
    process.env.ABC_SUPPLY_SANDBOX_CLIENT_ID = "cid";
    process.env.ABC_SUPPLY_SANDBOX_CLIENT_SECRET = "csecret";
    process.env.ABC_SUPPLY_SANDBOX_REFRESH_TOKEN = "rt";
    process.env.ABC_SUPPLY_BRANCH_NUMBER = "340";
    process.env.ABC_SUPPLY_SHIP_TO_NUMBER = "2010466-2";
    delete process.env.SUPPLIER_PRICE_FEED_ENDPOINTS;
    mockPrisma.material.findMany.mockResolvedValue([{ id: materialId, sku: "SKU-1" }]);
    // fetch hangs until the abort signal fires, like a stalled provider
    global.fetch = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
        }),
    ) as unknown as typeof fetch;

    jest.useFakeTimers();
    try {
      const fetcher = createDefaultSupplierFeedFetcher();
      const pending = fetcher(abcSupplierId, orgId);
      // Attach the assertion before the deadline fires so the abort
      // rejection is observed rather than unhandled.
      const assertion = expect(pending).rejects.toThrow(/abort/i);
      await jest.advanceTimersByTimeAsync(15_000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });
});
