import * as fs from "fs";
import * as path from "path";
import {
  DavisBaconApiError,
  DavisBaconClient,
  DavisBaconDetermination,
  fetchDeterminationText,
  parseDeterminationText,
  searchDeterminations,
} from "../modules/costbook/davisBaconSamGov";
import {
  parseDavisBaconSyncJobSpecs,
  syncCountyWageDeterminations,
  type DavisBaconStore,
  type StoredDavisBaconDetermination,
} from "../modules/costbook/davisBaconSync";

const fixturePath = path.join(__dirname, "fixtures", "davis-bacon", "IN20260050.txt");
const fixtureText = fs.readFileSync(fixturePath, "utf8");

// ---------------------------------------------------------------------------
// Parser (fixture-verified, carried over from the pilot)
// ---------------------------------------------------------------------------

describe("Davis-Bacon determination text parser", () => {
  const parsed = parseDeterminationText(fixtureText, 1);

  it("parses the header block from the real IN20260050 document", () => {
    expect(parsed.determination.wdNumber).toBe("IN20260050");
    expect(parsed.determination.revisionNumber).toBe(1);
    expect(parsed.determination.stateName).toBe("Indiana");
    expect(parsed.determination.constructionTypes).toEqual(["Residential"]);
    expect(parsed.determination.counties).toEqual(["Clay", "Sullivan", "Vermillion", "Vigo"]);
  });

  it("extracts every rate row across all union/survey blocks", () => {
    expect(parsed.rates).toHaveLength(14);
  });

  it("parses base rate and fringe separately", () => {
    const electrician = parsed.rates.find((rate) => rate.occupation === "ELECTRICIAN");
    expect(electrician).toMatchObject({
      wdNumber: "IN20260050",
      revisionNumber: 1,
      rateIdentifier: "ELEC0153-006",
      identifierDate: "06/08/2023",
      baseRate: 27.0,
      fringe: 18.29,
    });
  });

  it("retains formula fringe text instead of treating it as numeric", () => {
    const sample = [
      '"General Decision Number: CA20260022 01/01/2026',
      "State: California",
      "Construction Types: Building",
      "",
      "* ELEC0011-007 01/01/2024",
      "Rates Fringes",
      "ELECTRICIAN................$ 17.68 **  3%+29.77",
    ].join("\n");
    const sampleParsed = parseDeterminationText(sample, 1);
    expect(sampleParsed.rates[0]).toMatchObject({ fringe: null, fringeExpression: "3%+29.77" });
  });

  it("marks published daily base rates with the correct unit", () => {
    const sample = [
      '"General Decision Number: CA20260022 01/01/2026',
      "State: California",
      "Construction Types: Building",
      "",
      "* ELEC0011-007 01/01/2024",
      "Rates Fringes",
      "DIVER (PER DAY)............$ 418.96  22.00",
    ].join("\n");
    const sampleParsed = parseDeterminationText(sample, 1);
    expect(sampleParsed.rates[0]).toMatchObject({
      occupation: "DIVER (PER DAY)",
      rateUnit: "day",
      fringe: 22,
    });
  });
});

// ---------------------------------------------------------------------------
// Hardened client: retries, timeouts, politeness
// ---------------------------------------------------------------------------

function okResponse(body: unknown = {}): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(""),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as Response;
}

function errorResponse(status: number, retryAfter: string | null = null): Response {
  const headers = new Headers();
  if (retryAfter) headers.set("retry-after", retryAfter);
  return {
    ok: false,
    status,
    headers,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as Response;
}

describe("DavisBaconClient hardening", () => {
  it("retries a 503 and then succeeds", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse({ hello: "world" }));
    const client = new DavisBaconClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: () => Promise.resolve(),
      minDelayMs: 0,
    });
    const response = await client.fetchWithRetry("https://example.test/x");
    expect(response.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("honors the Retry-After header instead of the backoff schedule", async () => {
    const sleeps: number[] = [];
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(errorResponse(429, "2"))
      .mockResolvedValueOnce(okResponse());
    const client = new DavisBaconClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      minDelayMs: 0,
    });
    await client.fetchWithRetry("https://example.test/x");
    expect(sleeps).toContain(2000);
  });

  it("returns the last response after exhausting retries on retryable statuses", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(errorResponse(500));
    const client = new DavisBaconClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: () => Promise.resolve(),
      minDelayMs: 0,
      maxRetries: 2,
    });
    const response = await client.fetchWithRetry("https://example.test/x");
    expect(response.status).toBe(500);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("wraps repeated network failures in DavisBaconApiError", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("socket hangup"));
    const client = new DavisBaconClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: () => Promise.resolve(),
      minDelayMs: 0,
      maxRetries: 1,
    });
    await expect(client.fetchWithRetry("https://example.test/x")).rejects.toThrow(DavisBaconApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 404", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(errorResponse(404));
    const client = new DavisBaconClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: () => Promise.resolve(),
      minDelayMs: 0,
    });
    const response = await client.fetchWithRetry("https://example.test/x");
    expect(response.status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("aborts a hung request after the timeout", async () => {
    const fetchImpl = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const client = new DavisBaconClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: () => Promise.resolve(),
      minDelayMs: 0,
      timeoutMs: 25,
      maxRetries: 0,
    });
    await expect(client.fetchWithRetry("https://example.test/x")).rejects.toThrow(DavisBaconApiError);
  });

  it("sends the TradeOS user agent on every request", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse());
    const client = new DavisBaconClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: () => Promise.resolve(),
      minDelayMs: 0,
    });
    await client.fetchWithRetry("https://example.test/x");
    const headers = (fetchImpl.mock.calls[0] as unknown[])[1] as { headers: Record<string, string> };
    expect(headers.headers["User-Agent"]).toMatch(/^TradeOS-Costbook\//);
  });
});

describe("Davis-Bacon SAM.gov search client", () => {
  const searchBody = {
    _embedded: {
      results: [
        {
          fullReferenceNumber: "IN20260050",
          revisionNumber: 1,
          isActive: true,
          modifiedDate: "2026-05-18T00:00:00-04:00",
          constructionTypes: ["Residential"],
          location: {
            state: { code: "IN", name: "Indiana" },
            counties: [{ code: 15077, value: "Vigo" }],
          },
        },
        {
          fullReferenceNumber: "IN20250050",
          revisionNumber: 0,
          isActive: false,
          constructionTypes: ["Residential"],
          location: { state: { code: "IN", name: "Indiana" }, counties: [] },
        },
      ],
    },
  };

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue(okResponse(searchBody)) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("queries the dbra index with the mandatory hal+json accept header", async () => {
    await searchDeterminations({ state: "IN", county: "Vigo" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("index=dbra"),
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "application/hal+json" }),
      }),
    );
  });

  it("returns only active determinations with parsed metadata", async () => {
    const determinations = await searchDeterminations({ county: "Vigo" });
    expect(determinations).toHaveLength(1);
    expect(determinations[0]).toMatchObject({
      wdNumber: "IN20260050",
      revisionNumber: 1,
      state: "IN",
      stateName: "Indiana",
      counties: ["Vigo"],
      constructionTypes: ["Residential"],
      isActive: true,
    });
  });

  it("builds the key-free document download URL", async () => {
    const { determinationDownloadUrl } = await import("../modules/costbook/davisBaconSamGov");
    expect(determinationDownloadUrl("IN20260050", 1)).toContain("/wd/IN20260050/1/download");
  });

  it("fetches determination text through the hardened client", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ...okResponse(),
      text: () => Promise.resolve("DOCUMENT TEXT"),
    } as unknown as Response) as unknown as typeof fetch;
    const text = await fetchDeterminationText("IN20260050", 1);
    expect(text).toBe("DOCUMENT TEXT");
  });
});

// ---------------------------------------------------------------------------
// Sync service: change detection
// ---------------------------------------------------------------------------

function determination(overrides: Partial<DavisBaconDetermination> = {}): DavisBaconDetermination {
  return {
    wdNumber: "IN20260050",
    revisionNumber: 1,
    state: "IN",
    stateName: "Indiana",
    counties: ["Vigo"],
    constructionTypes: ["Residential"],
    modifiedDate: "2026-05-18T00:00:00-04:00",
    isActive: true,
    ...overrides,
  };
}

function fakeStore(initial: StoredDavisBaconDetermination[] = []): DavisBaconStore & {
  upserts: unknown[];
  replaced: unknown[];
} {
  const stored = new Map(initial.map((row) => [row.wdNumber, row]));
  const upserts: unknown[] = [];
  const replaced: unknown[] = [];
  return {
    upserts,
    replaced,
    listDeterminations: async () => [...stored.values()],
    upsertDetermination: async ({ determination }) => {
      const created = !stored.has(determination.wdNumber);
      stored.set(determination.wdNumber, {
        id: `id-${determination.wdNumber}`,
        wdNumber: determination.wdNumber,
        revisionNumber: determination.revisionNumber,
        modifiedDate: determination.modifiedDate || null,
      });
      upserts.push(determination.wdNumber);
      return { id: `id-${determination.wdNumber}`, created };
    },
    replaceRates: async (input) => {
      replaced.push(input.wdNumber);
      return 3;
    },
  };
}

describe("syncCountyWageDeterminations", () => {
  const spec = { orgId: "org-1", userId: "user-1", state: "IN", county: "Vigo" };

  const parseOk = () => ({ determination: determination(), rates: [] });

  it("adds a newly discovered determination", async () => {
    const store = fakeStore();
    const report = await syncCountyWageDeterminations(spec, {
      store,
      discover: async () => [determination()],
      fetchText: async () => fixtureText,
      parseDocument: parseOk,
    });
    expect(report.checked).toBe(1);
    expect(report.added).toBe(1);
    expect(report.unchanged).toBe(0);
    expect(store.upserts).toEqual(["IN20260050"]);
    expect(store.replaced).toEqual(["IN20260050"]);
  });

  it("skips unchanged determinations without re-fetching", async () => {
    const store = fakeStore([
      { id: "id-1", wdNumber: "IN20260050", revisionNumber: 1, modifiedDate: "2026-05-18T00:00:00-04:00" },
    ]);
    let fetchCalls = 0;
    const report = await syncCountyWageDeterminations(spec, {
      store,
      discover: async () => [determination()],
      fetchText: async () => {
        fetchCalls += 1;
        return fixtureText;
      },
      parseDocument: parseOk,
    });
    expect(report.checked).toBe(1);
    expect(report.unchanged).toBe(1);
    expect(report.added).toBe(0);
    expect(fetchCalls).toBe(0);
  });

  it("re-fetches when the revision number changes", async () => {
    const store = fakeStore([
      { id: "id-1", wdNumber: "IN20260050", revisionNumber: 1, modifiedDate: "2026-05-18T00:00:00-04:00" },
    ]);
    const report = await syncCountyWageDeterminations(spec, {
      store,
      discover: async () => [determination({ revisionNumber: 2 })],
      fetchText: async () => fixtureText,
      parseDocument: () => ({ determination: determination({ revisionNumber: 2 }), rates: [] }),
    });
    expect(report.updated).toBe(1);
    expect(store.upserts).toEqual(["IN20260050"]);
    expect(store.replaced).toEqual(["IN20260050"]);
  });

  it("re-fetches when the modified date changes even at the same revision", async () => {
    const store = fakeStore([
      { id: "id-1", wdNumber: "IN20260050", revisionNumber: 1, modifiedDate: "2026-05-18T00:00:00-04:00" },
    ]);
    const report = await syncCountyWageDeterminations(spec, {
      store,
      discover: async () => [determination({ modifiedDate: "2026-06-01T00:00:00-04:00" })],
      fetchText: async () => fixtureText,
      parseDocument: parseOk,
    });
    expect(report.updated).toBe(1);
  });

  it("captures per-WD failures without aborting the sync", async () => {
    const store = fakeStore();
    const report = await syncCountyWageDeterminations(spec, {
      store,
      discover: async () => [determination(), determination({ wdNumber: "IN20260003" })],
      fetchText: async (wdNumber) => {
        if (wdNumber === "IN20260050") throw new Error("boom");
        return fixtureText;
      },
      parseDocument: parseOk,
    });
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]).toMatchObject({ wdNumber: "IN20260050", error: "boom" });
    expect(report.added).toBe(1);
  });

  it("throws a descriptive error when discovery itself fails", async () => {
    const store = fakeStore();
    await expect(
      syncCountyWageDeterminations(spec, {
        store,
        discover: async () => {
          throw new Error("network down");
        },
      }),
    ).rejects.toThrow("Davis-Bacon discovery failed for IN/Vigo");
  });
});

describe("parseDavisBaconSyncJobSpecs", () => {
  it("parses a valid jobs array", () => {
    const specs = parseDavisBaconSyncJobSpecs(
      JSON.stringify([{ orgId: "o", userId: "u", state: "IN", county: "Vigo", label: "test" }]),
    );
    expect(specs).toEqual([{ orgId: "o", userId: "u", state: "IN", county: "Vigo", label: "test" }]);
  });

  it("returns [] for missing or blank config", () => {
    expect(parseDavisBaconSyncJobSpecs(undefined)).toEqual([]);
    expect(parseDavisBaconSyncJobSpecs("  ")).toEqual([]);
  });

  it("rejects invalid JSON and malformed entries", () => {
    expect(() => parseDavisBaconSyncJobSpecs("nope")).toThrow("not valid JSON");
    expect(() => parseDavisBaconSyncJobSpecs("{}")).toThrow("must be a JSON array");
    expect(() => parseDavisBaconSyncJobSpecs(JSON.stringify([{ orgId: "o" }]))).toThrow(
      "userId",
    );
  });
});
