// Unit coverage for modules/athena-observability/exporters.ts. Same
// DB-mocking convention as athena-observability.alerts.test.ts
// (jest.mock("../db/client", ...) / jest.mock("../db/requestSession", ...)).
// The hardest contract under test: an exporter must never let a failure
// (throwing implementation, rejected network call, timeout) propagate out
// of runAthenaObservabilityExport - it must always resolve to a result.

const mockPrisma = {
  athenaTelemetryRecordRow: {
    findMany: jest.fn(),
  },
};

const runWithBackgroundDatabaseSession: jest.Mock = jest.fn((_client: unknown, _input: unknown, operation: () => unknown) => operation());

jest.mock("../db/client", () => ({ prisma: mockPrisma, basePrisma: {} }));
jest.mock("../db/requestSession", () => ({ runWithBackgroundDatabaseSession }));

import { createConsoleExporter, createWebhookExporter, runAthenaObservabilityExport } from "../modules/athena-observability/exporters";
import type { AthenaObservabilityExporter } from "../modules/athena-observability/types";

const ORG = "org-1";

function telemetryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "span-1",
    orgId: ORG,
    executionId: "exec-1",
    requestId: "req-1",
    traceId: "trace-1",
    spanType: "tool",
    status: "ok",
    durationMs: 12,
    redaction: "metadata_only",
    costJson: null,
    metadataJson: { toolId: "tradeos.estimate.prepareDraft" },
    createdAt: new Date("2026-08-10T11:50:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  runWithBackgroundDatabaseSession.mockImplementation((_client: unknown, _input: unknown, operation: () => unknown) => operation());
  mockPrisma.athenaTelemetryRecordRow.findMany.mockResolvedValue([telemetryRow()]);
});

describe("createConsoleExporter", () => {
  let logSpy: jest.SpyInstance;

  afterEach(() => {
    logSpy?.mockRestore();
  });

  it("logs one line per span and reports every span as succeeded", async () => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const exporter = createConsoleExporter();

    const result = await exporter.export({
      spans: [
        {
          id: "span-1",
          orgId: ORG,
          executionId: "exec-1",
          requestId: "req-1",
          traceId: "trace-1",
          spanType: "tool",
          status: "ok",
          durationMs: 12,
          redaction: "metadata_only",
          cost: null,
          metadata: {},
          createdAt: "2026-08-10T11:50:00.000Z",
        },
      ],
      windowFrom: "2026-08-10T11:45:00.000Z",
      windowTo: "2026-08-10T12:00:00.000Z",
    });

    expect(result).toEqual({ succeeded: 1, failed: 0, errors: [] });
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});

describe("createWebhookExporter", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("rejects a non-https URL at construction time instead of leaking telemetry in cleartext", () => {
    expect(() => createWebhookExporter({ id: "wh-1", url: "http://example.com/hook" })).toThrow(/https/);
  });

  it("POSTs the batch and reports success on a 2xx response", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const exporter = createWebhookExporter({ id: "wh-1", url: "https://example.com/hook" });
    const batch = { spans: [{ id: "span-1" } as never], windowFrom: "a", windowTo: "b" };
    const result = await exporter.export(batch);

    expect(result).toEqual({ succeeded: 1, failed: 0, errors: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({ method: "POST", headers: { "content-type": "application/json" }, redirect: "error" })
    );

    const requestInit = fetchMock.mock.calls[0][1] as { body: string };
    const sentBody = JSON.parse(requestInit.body);
    expect(sentBody).toEqual({ spans: [{ id: "span-1" }], windowFrom: "a", windowTo: "b" });
  });

  it("reports a failure (never throws) on a non-2xx response", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    const exporter = createWebhookExporter({ id: "wh-1", url: "https://example.com/hook" });
    const result = await exporter.export({ spans: [{ id: "span-1" } as never], windowFrom: "a", windowTo: "b" });

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/500/);
  });

  it("reports a failure (never throws) when fetch rejects with a network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    const exporter = createWebhookExporter({ id: "wh-1", url: "https://example.com/hook" });
    const result = await exporter.export({ spans: [{ id: "span-1" } as never], windowFrom: "a", windowTo: "b" });

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual(["webhook_request_failed"]);
  });

  it("aborts and reports a timeout failure when the request exceeds timeoutMs", async () => {
    global.fetch = jest.fn((_url: string, init: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }) as unknown as typeof fetch;

    const exporter = createWebhookExporter({ id: "wh-1", url: "https://example.com/hook", timeoutMs: 20 });
    const result = await exporter.export({ spans: [{ id: "span-1" } as never], windowFrom: "a", windowTo: "b" });

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual(["webhook_timeout"]);
  });

  it("never calls fetch for an empty batch", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const exporter = createWebhookExporter({ id: "wh-1", url: "https://example.com/hook" });
    const result = await exporter.export({ spans: [], windowFrom: "a", windowTo: "b" });
    expect(result).toEqual({ succeeded: 0, failed: 0, errors: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("runAthenaObservabilityExport", () => {
  it("loads spans for the org/window and hands them to the exporter inside a background session", async () => {
    const exporter: AthenaObservabilityExporter = { id: "console", timeoutMs: 0, export: jest.fn().mockResolvedValue({ succeeded: 1, failed: 0, errors: [] }) };

    const result = await runAthenaObservabilityExport({
      orgId: ORG,
      userId: "user-1",
      exporter,
      windowFrom: "2026-08-10T11:45:00.000Z",
      windowTo: "2026-08-10T12:00:00.000Z",
    });

    expect(runWithBackgroundDatabaseSession).toHaveBeenCalledWith({}, { jobName: "athena-observability-export", orgId: ORG, userId: "user-1" }, expect.any(Function));
    expect(mockPrisma.athenaTelemetryRecordRow.findMany).toHaveBeenCalledWith({
      where: { orgId: ORG, createdAt: { gte: new Date("2026-08-10T11:45:00.000Z"), lt: new Date("2026-08-10T12:00:00.000Z") } },
      orderBy: { createdAt: "asc" },
    });
    expect(exporter.export).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ exporterId: "console", attempted: 1, succeeded: 1, failed: 0, errors: [], durationMs: expect.any(Number) });
  });

  it("never lets a throwing exporter propagate - the failure becomes part of the result", async () => {
    const exporter: AthenaObservabilityExporter = { id: "boom", timeoutMs: 0, export: jest.fn().mockRejectedValue(new Error("exporter exploded")) };

    const result = await runAthenaObservabilityExport({
      orgId: ORG,
      userId: "user-1",
      exporter,
      windowFrom: "2026-08-10T11:45:00.000Z",
      windowTo: "2026-08-10T12:00:00.000Z",
    });

    expect(result.exporterId).toBe("boom");
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual(["background_job_failed"]);
  });

  it("never lets a background-session bootstrap failure propagate either", async () => {
    runWithBackgroundDatabaseSession.mockRejectedValueOnce(new Error("no active organization membership"));
    const exporter: AthenaObservabilityExporter = { id: "console", timeoutMs: 0, export: jest.fn() };

    const result = await runAthenaObservabilityExport({
      orgId: ORG,
      userId: "user-1",
      exporter,
      windowFrom: "2026-08-10T11:45:00.000Z",
      windowTo: "2026-08-10T12:00:00.000Z",
    });

    expect(result.attempted).toBe(0);
    expect(result.errors).toEqual(["background_identity_invalid"]);
    expect(exporter.export).not.toHaveBeenCalled();
  });
});
