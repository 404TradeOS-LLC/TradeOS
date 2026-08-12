jest.mock("../db/client", () => ({
  basePrisma: { $queryRawUnsafe: jest.fn() },
}));

jest.mock("../backend/logging", () => ({ logError: jest.fn() }));

import { basePrisma } from "../db/client";
import { logError } from "../backend/logging";
import { buildHealthPayload, checkReadiness } from "../backend/health";

const queryRawUnsafe = basePrisma.$queryRawUnsafe as jest.Mock;
const mockedLogError = logError as jest.Mock;

describe("production health surfaces", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.GIT_COMMIT_SHA;
  });

  it("builds a dependency-free liveness payload", () => {
    process.env.GIT_COMMIT_SHA = "abc123";
    const payload = buildHealthPayload(new Date("2026-08-12T22:00:00.000Z"));
    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("tradeos-costbook-api");
    expect(payload.timestamp).toBe("2026-08-12T22:00:00.000Z");
    expect(payload.commitSha).toBe("abc123");
    expect(payload.uptimeSeconds).toEqual(expect.any(Number));
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("reports ready when the database probe succeeds", async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ "?column?": 1 }]);
    const payload = await checkReadiness(new Date("2026-08-12T22:00:00.000Z"));
    expect(queryRawUnsafe).toHaveBeenCalledWith("SELECT 1");
    expect(payload.status).toBe("ready");
    expect(payload.checks.database.status).toBe("ok");
    expect(payload.checks.database.latencyMs).toEqual(expect.any(Number));
    expect(mockedLogError).not.toHaveBeenCalled();
  });

  it("fails closed and logs when the database probe fails", async () => {
    queryRawUnsafe.mockRejectedValueOnce(new Error("database unavailable"));
    const payload = await checkReadiness(new Date("2026-08-12T22:00:00.000Z"));
    expect(payload.status).toBe("not_ready");
    expect(payload.checks.database.status).toBe("error");
    expect(mockedLogError).toHaveBeenCalledWith(
      "health.readiness_failed",
      expect.objectContaining({ component: "database", error: "database unavailable" }),
    );
  });
});
