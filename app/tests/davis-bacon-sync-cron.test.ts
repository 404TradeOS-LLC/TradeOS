import { Request, Response } from "express";
import {
  handleDavisBaconSyncCron,
  isAuthorizedCronRequest,
} from "../backend/routes/davisBaconSyncCron.routes";

function mockRequest(headers: Record<string, string> = {}): Request {
  return {
    get: (name: string) => headers[name.toLowerCase()] ?? headers[name],
  } as unknown as Request;
}

interface MockCronResponse {
  statusCode: number;
  body: unknown;
  status(code: number): MockCronResponse;
  json(payload: unknown): MockCronResponse;
}

function mockResponse(): Response & MockCronResponse {
  const res: MockCronResponse = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & MockCronResponse;
}

describe("isAuthorizedCronRequest", () => {
  const OLD = process.env.CRON_SECRET;

  afterEach(() => {
    if (OLD === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = OLD;
  });

  it("accepts the exact bearer secret", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(isAuthorizedCronRequest(mockRequest({ authorization: "Bearer test-secret" }))).toBe(true);
  });

  it("rejects a wrong secret and a missing secret", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(isAuthorizedCronRequest(mockRequest({ authorization: "Bearer wrong" }))).toBe(false);
    expect(isAuthorizedCronRequest(mockRequest())).toBe(false);
  });

  it("rejects everything when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedCronRequest(mockRequest({ authorization: "Bearer anything" }))).toBe(false);
  });
});

describe("handleDavisBaconSyncCron configuration", () => {
  const OLD_JOBS = process.env.DAVIS_BACON_SYNC_JOBS;

  afterEach(() => {
    if (OLD_JOBS === undefined) delete process.env.DAVIS_BACON_SYNC_JOBS;
    else process.env.DAVIS_BACON_SYNC_JOBS = OLD_JOBS;
  });

  it("returns 500 for invalid jobs JSON", async () => {
    process.env.DAVIS_BACON_SYNC_JOBS = "not-json";
    const res = mockResponse();
    await handleDavisBaconSyncCron(mockRequest(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "davis_bacon_sync_configuration_invalid" });
  });

  it("returns 503 when no jobs are configured", async () => {
    delete process.env.DAVIS_BACON_SYNC_JOBS;
    const res = mockResponse();
    await handleDavisBaconSyncCron(mockRequest(), res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: "davis_bacon_sync_not_configured" });
  });
});
