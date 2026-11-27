jest.mock("../db/client", () => {
  const queryRawUnsafe = jest.fn();
  const basePrisma = {
    $queryRawUnsafe: queryRawUnsafe,
    // The probe runs inside one transaction (SET LOCAL statement_timeout
    // + SELECT 1 + schema lookup); the transaction delegates to the same
    // $queryRawUnsafe mock so existing call assertions keep working.
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({ $queryRawUnsafe: queryRawUnsafe })),
  };
  return { basePrisma };
});

jest.mock("../backend/logging", () => ({ logError: jest.fn() }));

import { basePrisma } from "../db/client";
import { logError } from "../backend/logging";
import { buildHealthPayload, checkReadiness, resolveDatabaseProjectRef, resolveRuntimeEnvironment } from "../backend/health";

const queryRawUnsafe = basePrisma.$queryRawUnsafe as jest.Mock;
const mockedLogError = logError as jest.Mock;

describe("production health surfaces", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.GIT_COMMIT_SHA;
    delete process.env.VERCEL_ENV;
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;
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

  it("publishes the Vercel environment on the liveness payload, and omits it when unrecognized", () => {
    process.env.VERCEL_ENV = "preview";
    expect(buildHealthPayload(new Date("2026-08-12T22:00:00.000Z")).environment).toBe("preview");
    process.env.VERCEL_ENV = "production";
    expect(buildHealthPayload(new Date("2026-08-12T22:00:00.000Z")).environment).toBe("production");
    delete process.env.VERCEL_ENV;
    expect(buildHealthPayload(new Date("2026-08-12T22:00:00.000Z")).environment).toBeUndefined();
  });

  it("recognizes only the exact Vercel environment values", () => {
    expect(resolveRuntimeEnvironment({ VERCEL_ENV: "preview" } as NodeJS.ProcessEnv)).toBe("preview");
    expect(resolveRuntimeEnvironment({ VERCEL_ENV: "production" } as NodeJS.ProcessEnv)).toBe("production");
    expect(resolveRuntimeEnvironment({ VERCEL_ENV: "development" } as NodeJS.ProcessEnv)).toBe("development");
    expect(resolveRuntimeEnvironment({} as NodeJS.ProcessEnv)).toBeUndefined();
    expect(resolveRuntimeEnvironment({ VERCEL_ENV: "" } as NodeJS.ProcessEnv)).toBeUndefined();
    expect(resolveRuntimeEnvironment({ VERCEL_ENV: "staging" } as NodeJS.ProcessEnv)).toBeUndefined();
    expect(resolveRuntimeEnvironment({ VERCEL_ENV: "Preview" } as NodeJS.ProcessEnv)).toBeUndefined();
    expect(resolveRuntimeEnvironment({ VERCEL_ENV: "PRODUCTION" } as NodeJS.ProcessEnv)).toBeUndefined();
  });

  it("reports ready when the database probe succeeds", async () => {
    process.env.DATABASE_URL = "postgresql://app:example@db.qfbgdkbamfaasmtjfyru.supabase.co:5432/postgres";
    queryRawUnsafe.mockResolvedValueOnce([]);
    queryRawUnsafe.mockResolvedValueOnce([{ "?column?": 1 }]);
    queryRawUnsafe.mockResolvedValueOnce([
      { table_name: "estimates", column_name: "tax_pct" },
      { table_name: "estimates", column_name: "tax_amount" },
      { table_name: "invoices", column_name: "subtotal" },
      { table_name: "invoices", column_name: "tax_pct" },
      { table_name: "invoices", column_name: "tax_amount" },
      { table_name: "contracts", column_name: "contract_amount" },
      { table_name: "contracts", column_name: "snapshot_json" },
      { table_name: "contracts", column_name: "signature_user_agent_reported" },
      { table_name: "job_expenses", column_name: "payment_responsibility" },
      { table_name: "job_expenses", column_name: "receipt_storage_path" },
      { table_name: "job_expenses", column_name: "idempotency_key" },
      { table_name: "job_expenses", column_name: "voided_at" },
      { table_name: "job_expense_events", column_name: "expense_id" },
    ]);
    const payload = await checkReadiness(new Date("2026-08-12T22:00:00.000Z"));
    expect(queryRawUnsafe).toHaveBeenCalledWith("SET LOCAL statement_timeout = '5s'");
    expect(queryRawUnsafe).toHaveBeenCalledWith("SELECT 1");
    expect(payload.status).toBe("ready");
    expect(payload.checks.database.status).toBe("ok");
    expect(payload.checks.database.projectRef).toBe("qfbgdkbamfaasmtjfyru");
    expect(payload.checks.schema.status).toBe("ok");
    expect(payload.checks.database.latencyMs).toEqual(expect.any(Number));
    expect(mockedLogError).not.toHaveBeenCalled();
  });

  it("identifies the data plane from a pooled DATABASE_URL or SUPABASE_URL, and omits it when neither parses", () => {
    expect(resolveDatabaseProjectRef({
      DATABASE_URL: "postgresql://postgres.qfbgdkbamfaasmtjfyru@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
    } as NodeJS.ProcessEnv)).toBe("qfbgdkbamfaasmtjfyru");
    expect(resolveDatabaseProjectRef({
      SUPABASE_URL: "https://qfbgdkbamfaasmtjfyru.supabase.co",
    } as NodeJS.ProcessEnv)).toBe("qfbgdkbamfaasmtjfyru");
    expect(resolveDatabaseProjectRef({} as NodeJS.ProcessEnv)).toBeUndefined();
    expect(resolveDatabaseProjectRef({ DATABASE_URL: "not-a-url" } as NodeJS.ProcessEnv)).toBeUndefined();
  });

  it("refuses an unverified DATABASE_URL even when SUPABASE_URL claims staging", () => {
    const stagingUrl = "https://qfbgdkbamfaasmtjfyru.supabase.co";
    const ambiguousDatabaseUrls = [
      "not-a-url",
      "postgresql://app@db.example.com:5432/postgres",
      "https://db.qfbgdkbamfaasmtjfyru.supabase.co/postgres",
      "postgresql://app@aws-0-us-east-2.pooler.supabase.com:6543/postgres",
      "postgresql://app@db.qfbgdkbamfaasmtjfyru.supabase.co:5432/postgres?host=db.kssaceuetdjwfqnbzhly.supabase.co",
    ];
    for (const databaseUrl of ambiguousDatabaseUrls) {
      expect(resolveDatabaseProjectRef({
        DATABASE_URL: databaseUrl,
        SUPABASE_URL: stagingUrl,
      } as NodeJS.ProcessEnv)).toBeUndefined();
    }
    expect(resolveDatabaseProjectRef({
      DATABASE_URL: "postgresql://app@db.kssaceuetdjwfqnbzhly.supabase.co:5432/postgres",
      SUPABASE_URL: stagingUrl,
    } as NodeJS.ProcessEnv)).toBe("kssaceuetdjwfqnbzhly");
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

  it("fails closed within ~5s when the database probe hangs", async () => {
    // A hung database must 503 fast instead of holding the function: the
    // probe is bounded by the statement timeout server-side and by the
    // application-level race, so even a query that never settles resolves
    // to not_ready once the bound fires.
    jest.useFakeTimers();
    try {
      queryRawUnsafe.mockImplementation(() => new Promise(() => undefined));
      const pending = checkReadiness(new Date("2026-08-12T22:00:00.000Z"));
      await jest.advanceTimersByTimeAsync(5_000);
      const payload = await pending;
      expect(payload.status).toBe("not_ready");
      expect(payload.checks.database.status).toBe("error");
      expect(mockedLogError).toHaveBeenCalledWith(
        "health.readiness_failed",
        expect.objectContaining({ component: "database", error: "readiness probe timed out" }),
      );
    } finally {
      queryRawUnsafe.mockReset();
      jest.useRealTimers();
    }
  });

  it("fails closed when dashboard-critical schema columns are missing", async () => {
    queryRawUnsafe.mockResolvedValueOnce([]);
    queryRawUnsafe.mockResolvedValueOnce([{ "?column?": 1 }]);
    queryRawUnsafe.mockResolvedValueOnce([{ table_name: "estimates", column_name: "tax_pct" }]);

    const payload = await checkReadiness(new Date("2026-08-12T22:00:00.000Z"));

    expect(payload.status).toBe("not_ready");
    expect(payload.checks.database.status).toBe("ok");
    expect(payload.checks.schema).toEqual(expect.objectContaining({
      status: "error",
      missingColumns: expect.arrayContaining(["estimates.tax_amount", "invoices.tax_pct"]),
    }));
    expect(mockedLogError).toHaveBeenCalledWith(
      "health.readiness_failed",
      expect.objectContaining({ component: "schema" }),
    );
  });

  it("fails closed when expense migration columns are missing", async () => {
    queryRawUnsafe.mockResolvedValueOnce([]);
    queryRawUnsafe.mockResolvedValueOnce([{ "?column?": 1 }]);
    queryRawUnsafe.mockResolvedValueOnce([
      { table_name: "estimates", column_name: "tax_pct" },
      { table_name: "estimates", column_name: "tax_amount" },
      { table_name: "invoices", column_name: "subtotal" },
      { table_name: "invoices", column_name: "tax_pct" },
      { table_name: "invoices", column_name: "tax_amount" },
      { table_name: "contracts", column_name: "contract_amount" },
      { table_name: "contracts", column_name: "snapshot_json" },
      { table_name: "contracts", column_name: "signature_user_agent_reported" },
    ]);

    const payload = await checkReadiness(new Date("2026-08-12T22:00:00.000Z"));

    expect(payload.status).toBe("not_ready");
    expect(payload.checks.database.status).toBe("ok");
    expect(payload.checks.schema).toEqual(expect.objectContaining({
      status: "error",
      missingColumns: expect.arrayContaining([
        "job_expenses.payment_responsibility",
        "job_expense_events.expense_id",
      ]),
    }));
  });
});
