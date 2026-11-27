import "dotenv/config";
import { basePrisma } from "../db/client";
import { AbcCatalogClient } from "../modules/supplier-integration/abcCatalog";
import { loadAbcSupplyAuthConfig } from "../modules/supplier-integration/abcSupply";
import {
  AbcCatalogImportError,
  runFullCatalogImport,
  type AbcCatalogImportReport,
} from "../modules/supplier-integration/abcCatalogImport";

/**
 * One-shot ABC shared-catalog full import (issue #735, Phase 2).
 *
 * Sandbox only. Reads the provider catalog with the server
 * `client_credentials` + `product.read` token and writes the shared,
 * org-less reference tables through the Phase 1 ingestion flag. Never
 * requests pricing, never writes `SupplierProduct` / `Material` rows.
 *
 * Usage:
 *   npx ts-node scripts/run-abc-catalog-import.ts [--dry-run]
 *     [--max-pages N] [--resume <run-id>] [--correlation-id <id>]
 *     [--db-capacity-bytes N]
 *
 * - `--dry-run` counts what would change and writes nothing (no run row).
 * - `--max-pages N` bounds the run to N item pages; the run ends `partial`
 *   with a checkpoint and can be resumed.
 * - `--resume <run-id>` continues an interrupted run from its checkpoint.
 * - `--db-capacity-bytes N` (or `ABC_CATALOG_DB_CAPACITY_BYTES`) is the
 *   total database capacity in bytes, recorded by the operator from the
 *   Supabase dashboard; the import refuses to start below ~2 GB free.
 *
 * Stdout carries exactly one JSON report line (counts only — no item
 * content, tokens, or payloads). Progress lines go to stderr. Exit codes:
 * 0 succeeded, 2 partial (bounded stop or provider drift — resumable),
 * 1 failed.
 */
export function parseArgs(argv: string[]): {
  dryRun: boolean;
  maxPages: number;
  resumeRunId?: string;
  correlationId?: string;
  dbCapacityBytes?: number;
} {
  const args = { dryRun: false, maxPages: 0 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--max-pages") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 0) throw new Error("invalid_import_arguments");
      args.maxPages = value;
    } else if (arg === "--resume") {
      const value = argv[++i];
      if (!value) throw new Error("invalid_import_arguments");
      (args as { resumeRunId?: string }).resumeRunId = value;
    } else if (arg === "--correlation-id") {
      const value = argv[++i];
      if (!value) throw new Error("invalid_import_arguments");
      (args as { correlationId?: string }).correlationId = value;
    } else if (arg === "--db-capacity-bytes") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value <= 0) throw new Error("invalid_import_arguments");
      (args as { dbCapacityBytes?: number }).dbCapacityBytes = value;
    } else {
      throw new Error("invalid_import_arguments");
    }
  }
  return args as {
    dryRun: boolean;
    maxPages: number;
    resumeRunId?: string;
    correlationId?: string;
    dbCapacityBytes?: number;
  };
}

export function classifyImportError(error: unknown): string {
  if (error instanceof AbcCatalogImportError) return error.code;
  const message = error instanceof Error ? error.message : "";
  if (message === "invalid_import_arguments") return "invalid_import_arguments";
  if (message === "missing_sandbox_client_credentials") return "missing_sandbox_client_credentials";
  if (/^ABC catalog provider denied request: HTTP \d{3}$/.test(message)) return "provider_denied";
  if (message === "ABC catalog provider request failed") return "provider_request_failed";
  const unavailable = /^ABC catalog provider unavailable: HTTP (\d{3})$/.exec(message);
  if (unavailable) return "provider_unavailable_http_" + unavailable[1];
  if (message === "Duplicate ABC item number in provider page") return "provider_duplicate_item";
  if (message === "ABC catalog pagination does not match the requested page") return "provider_pagination_mismatch";
  return "import_or_provider_failure";
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadAbcSupplyAuthConfig();
  if (!config) throw new Error("missing_sandbox_client_credentials");
  // 1000-item pages exceed the 12 s interactive timeout (Phase 0 measured
  // p50 ~21.5 s / p95 ~28.2 s); the import gets the same 120 s budget.
  const client = new AbcCatalogClient(
    { clientId: config.clientId, clientSecret: config.clientSecret },
    fetch, Date.now, undefined, { requestTimeoutMs: 120_000, maxAttempts: 2 },
  );
  const report: AbcCatalogImportReport = await runFullCatalogImport(basePrisma, client, {
    dryRun: args.dryRun,
    maxPages: args.maxPages,
    resumeRunId: args.resumeRunId,
    correlationId: args.correlationId,
    dbCapacityBytes: args.dbCapacityBytes,
    log: (line) => process.stderr.write(line + "\n"),
  });
  // Counts only. No item numbers, names, descriptions, tokens, or payloads.
  process.stdout.write(JSON.stringify(report) + "\n");
  return report.status === "succeeded" ? 0 : report.status === "partial" ? 2 : 1;
}

if (require.main === module) {
  void main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write("ABC shared-catalog import failed: " + classifyImportError(error) + "\n");
      process.exitCode = 1;
    })
    .finally(async () => {
      await basePrisma.$disconnect();
    });
}
