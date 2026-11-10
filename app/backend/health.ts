import { basePrisma } from "../db/client";
import { logError } from "./logging";

export interface HealthPayload {
  status: "ok";
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  commitSha?: string;
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

function serviceMetadata() {
  return {
    service: "tradeos-costbook-api",
    version: process.env.npm_package_version ?? "0.1.0",
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA,
  };
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
  return {
    status: "ok",
    service: metadata.service,
    version: metadata.version,
    timestamp: now.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    ...(metadata.commitSha ? { commitSha: metadata.commitSha } : {}),
  };
}

export async function checkReadiness(now: Date = new Date()): Promise<ReadinessPayload> {
  const startedAt = process.hrtime.bigint();
  const projectRef = resolveDatabaseProjectRef();

  try {
    await basePrisma.$queryRawUnsafe("SELECT 1");
    const columns = await basePrisma.$queryRawUnsafe<SchemaColumn[]>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name, column_name) IN (${DASHBOARD_SCHEMA_REQUIREMENTS.map(([table, column]) => `('${table}', '${column}')`).join(", ")})
    `);
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
