const mockPrisma = {
  supplier: { findFirst: jest.fn() },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { fetchConfiguredSupplierFeed } from "../modules/supplier-integration/feed";

const supplierId = "11111111-1111-4111-8111-111111111111";
const materialId = "22222222-2222-4222-8222-222222222222";
const originalEnv = process.env.SUPPLIER_PRICE_FEED_ENDPOINTS;
const originalFetch = global.fetch;

function response(body: unknown, options: { ok?: boolean; status?: number; contentLength?: string } = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: new Headers(options.contentLength ? { "content-length": options.contentLength } : {}),
    text: async () => text,
  } as never;
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
    expect(await fetchConfiguredSupplierFeed(supplierId)).toEqual([]);
    expect(mockPrisma.supplier.findFirst).not.toHaveBeenCalled();
  });

  it("rejects non-HTTPS configured endpoints", async () => {
    process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = JSON.stringify({ [supplierId]: "http://example.test/prices" });
    await expect(fetchConfiguredSupplierFeed(supplierId)).rejects.toThrow("must use HTTPS");
  });

  it("fetches a strict quote payload with the supplier bearer key", async () => {
    process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = JSON.stringify({ [supplierId]: "https://supplier.example/prices" });
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: supplierId, apiIntegrationKey: "secret-key" });
    global.fetch = jest.fn().mockResolvedValue(response({ quotes: [{ materialId, proposedUnitCost: 12.34 }] }));

    await expect(fetchConfiguredSupplierFeed(supplierId)).resolves.toEqual([{ materialId, proposedUnitCost: 12.34 }]);
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

    await expect(fetchConfiguredSupplierFeed(supplierId)).rejects.toBeTruthy();
  });

  it("rejects upstream HTTP failures", async () => {
    process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = JSON.stringify({ [supplierId]: "https://supplier.example/prices" });
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: supplierId, apiIntegrationKey: null });
    global.fetch = jest.fn().mockResolvedValue(response("unavailable", { ok: false, status: 503 }));

    await expect(fetchConfiguredSupplierFeed(supplierId)).rejects.toThrow("HTTP 503");
  });

  it("aborts a supplier feed that exceeds the timeout", async () => {
    jest.useFakeTimers();
    process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = JSON.stringify({ [supplierId]: "https://supplier.example/prices" });
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: supplierId, apiIntegrationKey: null });
    global.fetch = jest.fn().mockImplementation((_url: URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("supplier feed aborted")), { once: true });
    })) as typeof fetch;

    const request = fetchConfiguredSupplierFeed(supplierId);
    const rejection = expect(request).rejects.toThrow("supplier feed aborted");
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(15_000);
    await rejection;
  });

  it("rejects oversized responses before parsing them", async () => {
    process.env.SUPPLIER_PRICE_FEED_ENDPOINTS = JSON.stringify({ [supplierId]: "https://supplier.example/prices" });
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: supplierId, apiIntegrationKey: null });
    global.fetch = jest.fn().mockResolvedValue(response("{}", { contentLength: "2000001" }));

    await expect(fetchConfiguredSupplierFeed(supplierId)).rejects.toThrow("size limit");
  });
});
