import "dotenv/config";
import { basePrisma } from "../db/client";
import {
  SUPPLIER_PRICES_47802,
  type SupplierPriceObservation,
} from "../modules/costbook/supplierPrices47802";

/**
 * One-shot operator script: create one Supplier row per distinct supplier in
 * the static Terre Haute costbook dataset (app/modules/costbook/
 * supplierPrices47802.ts), so live integrations can reference suppliers by
 * UUID instead of hand-made rows.
 *
 * The dataset is the source of truth for supplier identity: each row's
 * supplierCode becomes the Supplier.apiIntegrationKey, which is the stable
 * natural key later syncs match on. Re-running is idempotent — existing rows
 * are matched by (orgId, apiIntegrationKey), falling back to (orgId, name),
 * and updated in place.
 *
 * At the end it prints a supplierCode -> UUID table; copy the ABC_SUPPLY row
 * into ABC_SUPPLY_SANDBOX_SUPPLIER_ID on the host that runs the feed.
 *
 * Usage:
 *   npm run db:import-suppliers -- --dry-run
 *   npm run db:import-suppliers -- --org-id=<uuid>   # only needed when the DB holds >1 organization
 *
 * Writes to whatever DATABASE_URL is configured — the operator is expected to
 * point it at the active Costbook database. --dry-run previews without writing.
 */

export interface DatasetSupplier {
  supplierCode: string;
  name: string;
  website: string | null;
}

const KNOWN_SUPPLIERS: Record<string, { name: string; website: string | null }> = {
  ABC_SUPPLY: { name: "ABC Supply", website: "https://www.abcsupply.com" },
  HOME_DEPOT: { name: "Home Depot", website: "https://www.homedepot.com" },
  JONES_AND_SONS: { name: "Jones & Sons", website: "https://www.jonesandsons.com" },
  LOWES: { name: "Lowe's", website: "https://www.lowes.com" },
  MENARDS: { name: "Menards", website: "https://www.menards.com" },
  NIEHAUS: { name: "Niehaus", website: null },
};

function prettifySupplierCode(code: string): string {
  return code
    .split("_")
    .map((w) => (w.length > 0 ? w[0] + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Distinct suppliers in the dataset, sorted by supplierCode. Pure — unit-tested. */
export function deriveSuppliers(
  observations: readonly SupplierPriceObservation[],
): DatasetSupplier[] {
  const seen = new Map<string, DatasetSupplier>();
  for (const o of observations) {
    if (seen.has(o.supplierCode)) continue;
    const known = KNOWN_SUPPLIERS[o.supplierCode];
    seen.set(o.supplierCode, {
      supplierCode: o.supplierCode,
      name: known?.name ?? prettifySupplierCode(o.supplierCode),
      website: known?.website ?? null,
    });
  }
  return [...seen.values()].sort((a, b) => a.supplierCode.localeCompare(b.supplierCode));
}

export interface OrganizationRef {
  id: string;
  name: string;
}

/**
 * Pick the target organization. A single org is used automatically; with
 * several, the operator must pass --org-id explicitly. Pure — unit-tested.
 */
export function resolveTargetOrgId(
  orgs: readonly OrganizationRef[],
  requestedId: string | null,
): string {
  if (requestedId) {
    const match = orgs.find((o) => o.id === requestedId);
    if (!match) throw new Error(`--org-id ${requestedId} matches no organization in this database`);
    return match.id;
  }
  if (orgs.length === 0) throw new Error("no organizations found in this database — nothing to import suppliers into");
  if (orgs.length > 1) {
    const list = orgs.map((o) => `  ${o.id}  ${o.name}`).join("\n");
    throw new Error(`multiple organizations found — pass --org-id explicitly:\n${list}`);
  }
  return orgs[0].id;
}

function parseArgs(argv: readonly string[]): { dryRun: boolean; orgId: string | null } {
  let dryRun = false;
  let orgId: string | null = null;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--org-id=")) orgId = arg.slice("--org-id=".length).trim() || null;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return { dryRun, orgId };
}

function databaseHostLabel(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname || "(unparseable DATABASE_URL)";
  } catch {
    return "(no DATABASE_URL set)";
  }
}

async function main() {
  const { dryRun, orgId } = parseArgs(process.argv.slice(2));
  const suppliers = deriveSuppliers(SUPPLIER_PRICES_47802);
  console.log(`[import-suppliers] target database host: ${databaseHostLabel()}${dryRun ? " (dry run — no writes)" : ""}`);

  const orgs = await basePrisma.organization.findMany({ select: { id: true, name: true } });
  const targetOrgId = resolveTargetOrgId(orgs, orgId);
  const targetOrg = orgs.find((o) => o.id === targetOrgId);
  console.log(`[import-suppliers] target organization: ${targetOrg?.name ?? "(unknown)"} ${targetOrgId}`);
  console.log(`[import-suppliers] ${suppliers.length} distinct suppliers in dataset`);

  const results: { code: string; id: string; action: string }[] = [];
  for (const s of suppliers) {
    const existing =
      (await basePrisma.supplier.findFirst({
        where: { orgId: targetOrgId, apiIntegrationKey: s.supplierCode },
      })) ??
      (await basePrisma.supplier.findFirst({
        where: { orgId: targetOrgId, name: s.name },
      }));

    if (dryRun) {
      results.push({ code: s.supplierCode, id: existing?.id ?? "(would create)", action: existing ? "would update" : "would create" });
      continue;
    }

    if (existing) {
      const updated = await basePrisma.supplier.update({
        where: { id: existing.id },
        data: { name: s.name, website: s.website, apiIntegrationKey: s.supplierCode },
      });
      results.push({ code: s.supplierCode, id: updated.id, action: "updated" });
    } else {
      const created = await basePrisma.supplier.create({
        data: { orgId: targetOrgId, name: s.name, website: s.website, apiIntegrationKey: s.supplierCode },
      });
      results.push({ code: s.supplierCode, id: created.id, action: "created" });
    }
  }

  console.log("[import-suppliers] supplierCode -> supplier UUID:");
  for (const r of results) {
    console.log(`  ${r.code}  ${r.id}  (${r.action})`);
  }
}

// Only run when executed directly (ts-node scripts/import-suppliers-from-dataset.ts),
// not when imported for its pure helpers by tests.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  /import-suppliers-from-dataset(\.[cm]?[jt]s)?$/.test(process.argv[1]);
if (invokedDirectly) {
  main()
    .catch((err) => {
      console.error(`[import-suppliers] failed: ${err instanceof Error ? err.message : err}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await basePrisma.$disconnect();
    });
}
