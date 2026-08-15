const mockPrisma = {
  supplier: { findFirst: jest.fn() },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { fetchConfiguredSupplierFeed } from "../modules/supplier-integration/feed";

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
