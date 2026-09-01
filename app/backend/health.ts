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
] as const;

type SchemaColumn = { table_name: string; column_name: string };

function serviceMetadata() {
  return {
    service: "tradeos-costbook-api",
    version: process.env.npm_package_version ?? "0.1.0",
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA,
  };
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
          database: { status: "ok", latencyMs: Number(latencyMs.toFixed(1)) },
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
        },
        schema: { status: "error" },
      },
    };
  }
}
