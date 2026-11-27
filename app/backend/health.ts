import { basePrisma } from "../db/client";
import { logError } from "./logging";

export type RuntimeEnvironment = "production" | "preview" | "development";

export interface HealthPayload {
  status: "ok";
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  commitSha?: string;
  // The Vercel environment the deployment runs in (a public identifier, not
  // a secret). Evidence automation verifies it from the deployment instead
  // of trusting an operator attestation: staging and PR-preview deployments
  // report "preview", production reports "production". Omitted when the
  // runtime does not publish a recognized value, so callers fail closed
  // rather than guessing.
  environment?: RuntimeEnvironment;
}

export interface ReadinessPayload {
  status: "ready" | "not_ready";
  service: string;
  timestamp: string;
  checks: {
    database: {
      status: "ok" | "error";
      latencyMs: number;
      // The Supabase project ref of the configured data plane (a public
      // identifier, not a secret). The staging attestation script requires
      // it in /ready before excusing missing database bindings: healthy
      // connectivity alone cannot prove the deployment talks to staging
      // rather than production. Omitted when no configured URL parses.
      projectRef?: string;
    };
    schema: {
      status: "ok" | "error";
      missingColumns?: string[];
    };
  };
}

const DASHBOARD_SCHEMA_REQUIREMENTS = [
  ["estimates", "tax_pct"],
  ["estimates", "tax_amount"],
  ["invoices", "subtotal"],
  ["invoices", "tax_pct"],
  ["invoices", "tax_amount"],
  ["contracts", "contract_amount"],
  ["contracts", "snapshot_json"],
  ["contracts", "signature_user_agent_reported"],
  // Expense routes read columns only the expense migrations add, and the
  // audit listing reads the events table. Until those migrations are
  // applied, readiness stays not_ready rather than letting expense requests
  // fail per-call: apply the expense migrations before relying on a ready
  // deployment for expense traffic.
  ["job_expenses", "payment_responsibility"],
  ["job_expenses", "receipt_storage_path"],
  ["job_expenses", "idempotency_key"],
  ["job_expenses", "voided_at"],
  ["job_expense_events", "expense_id"],
] as const;

type SchemaColumn = { table_name: string; column_name: string };

// The probe is two cheap queries; its healthy latency is connection
// establishment, not query cost — but a hung database must fail fast
// with 503 instead of holding the function until the platform limit.
// Two bounds, belt and suspenders: SET LOCAL statement_timeout cancels
// a hung query server-side inside the probe transaction, and the
// application-level race bounds the wall clock even when the hang is
// before any query runs (e.g. waiting on the single pooled connection).
// Neither changes the response shape.
const HEALTH_PROBE_STATEMENT_TIMEOUT = "5s";
const HEALTH_PROBE_TIMEOUT_MS = 5_000;

async function runReadinessProbes(): Promise<SchemaColumn[]> {
  const probes = basePrisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`SET LOCAL statement_timeout = '${HEALTH_PROBE_STATEMENT_TIMEOUT}'`);
    await tx.$queryRawUnsafe("SELECT 1");
    return tx.$queryRawUnsafe<SchemaColumn[]>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name, column_name) IN (${DASHBOARD_SCHEMA_REQUIREMENTS.map(([table, column]) => `('${table}', '${column}')`).join(", ")})
    `);
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      probes,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("readiness probe timed out")), HEALTH_PROBE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

function serviceMetadata() {
  return {
    service: "tradeos-costbook-api",
    version: process.env.npm_package_version ?? "0.1.0",
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA,
  };
}

// Identify the Vercel environment the deployment runs in. Only the exact
// values Vercel publishes are recognized; anything else (including a
// differently-cased value) is unrecognized and returns undefined, so
// callers fail closed rather than treating an unknown runtime as a
// non-production target.
export function resolveRuntimeEnvironment(env: NodeJS.ProcessEnv = process.env): RuntimeEnvironment | undefined {
  const value = env.VERCEL_ENV;
  if (value === "production" || value === "preview" || value === "development") {
    return value;
  }
  return undefined;
}

// Identify the configured Supabase data plane from the connection URLs:
// DATABASE_URL first (direct `db.<ref>.supabase.co` host, or the pooler
// username `postgres.<ref>`), then SUPABASE_URL (`<ref>.supabase.co`).
// Returns undefined when neither parses, so callers fail closed rather
// than guessing. The ref is a public identifier, never a secret.
export function resolveDatabaseProjectRef(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl) {
    try {
      const db = new URL(databaseUrl);
      // A configured database URL must prove its own project. Never let a
      // separate SUPABASE_URL conceal an unrecognized or overridden DB target.
      if (!["postgres:", "postgresql:"].includes(db.protocol) || db.searchParams.has("host")) {
        return undefined;
      }
      const direct = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(db.hostname)?.[1];
      if (direct) return direct;
      if (/(^|\.)pooler\.supabase\.com$/.test(db.hostname)) {
        const poolerRef = /^[a-z_][a-z0-9_]*\.([a-z0-9]{20})$/i.exec(decodeURIComponent(db.username))?.[1];
        if (poolerRef) return poolerRef;
      }
    } catch {
      // Invalid configured database identity is not a staging attestation.
    }
    return undefined;
  }
  // Fallback is allowed only if no DATABASE_URL was configured.
  const supabaseUrl = env.SUPABASE_URL;
  if (!supabaseUrl) return undefined;
  try {
    return /^([a-z0-9]{20})\.supabase\.co$/.exec(new URL(supabaseUrl).hostname)?.[1];
  } catch {
    return undefined;
  }
}

export function buildHealthPayload(now: Date = new Date()): HealthPayload {
  const metadata = serviceMetadata();
  const environment = resolveRuntimeEnvironment();
  return {
    status: "ok",
    service: metadata.service,
    version: metadata.version,
    timestamp: now.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    ...(metadata.commitSha ? { commitSha: metadata.commitSha } : {}),
    ...(environment ? { environment } : {}),
  };
}

export async function checkReadiness(now: Date = new Date()): Promise<ReadinessPayload> {
  const startedAt = process.hrtime.bigint();
  const projectRef = resolveDatabaseProjectRef();

  try {
    const columns = await runReadinessProbes();
    const present = new Set((columns ?? []).map(({ table_name, column_name }) => `${table_name}.${column_name}`));
    const missingColumns = DASHBOARD_SCHEMA_REQUIREMENTS
      .map(([table, column]) => `${table}.${column}`)
      .filter((column) => !present.has(column));
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (missingColumns.length > 0) {
      logError("health.readiness_failed", {
        component: "schema",
        missingColumns,
      });
      return {
        status: "not_ready",
        service: serviceMetadata().service,
        timestamp: now.toISOString(),
        checks: {
          database: { status: "ok", latencyMs: Number(latencyMs.toFixed(1)), ...(projectRef ? { projectRef } : {}) },
          schema: { status: "error", missingColumns },
        },
      };
    }
    return {
      status: "ready",
      service: serviceMetadata().service,
      timestamp: now.toISOString(),
      checks: {
        database: {
          status: "ok",
          latencyMs: Number(latencyMs.toFixed(1)),
          ...(projectRef ? { projectRef } : {}),
        },
        schema: { status: "ok" },
      },
    };
  } catch (error) {
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logError("health.readiness_failed", {
      component: "database",
      latencyMs: Number(latencyMs.toFixed(1)),
      error: error instanceof Error ? error.message : "Unknown readiness error",
    });

    return {
      status: "not_ready",
      service: serviceMetadata().service,
      timestamp: now.toISOString(),
      checks: {
        database: {
          status: "error",
          latencyMs: Number(latencyMs.toFixed(1)),
          ...(projectRef ? { projectRef } : {}),
        },
        schema: { status: "error" },
      },
    };
  }
}
