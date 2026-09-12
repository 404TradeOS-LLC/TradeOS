#!/usr/bin/env node
// Deterministic, read-only data-quality/provenance audit for the canonical
// Knowledge Engine cost-item corpus (packages/knowledge-engine/exports/json/costbook.json).
//
// This never edits data. It reports counts and a few examples for each
// finding so a human can decide what (if anything) to act on. Only clearly
// invalid structure (duplicate IDs, missing identity fields, non-numeric
// cost fields, dangling assembly references) exits non-zero; missing
// provenance/timestamp/confidence metadata and category/trade mismatches
// are reported as warnings only, per the project's "do not fabricate,
// prefer warnings over destructive migrations" rule for this corpus.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..");

export const KNOWN_UNITS = new Set(["SF", "LF", "EA", "HR", "CY", "SQ", "CF"]);
export const KNOWN_CONFIDENCE = new Set(["low", "medium", "high"]);
// Mirrors app/modules/costbook/provenance.ts's costDataProvenanceStatus.
// This root-level script runs under plain Node (no TypeScript build step),
// so it cannot import that .ts module directly; keep these two lists in
// sync if the shared vocabulary ever changes.
export const KNOWN_PROVENANCE_STATUS = new Set(["documented", "unverified-legacy", "placeholder"]);
// Category spellings the app already normalizes at runtime
// (app/modules/knowledge-runtime/repository.ts's normalizeTradeName, and the
// Hvac/HVAC case-insensitive handling documented in
// app/tests/knowledge-runtime.trade-inference.test.ts). Reported as
// "known normalization" rather than "unmapped category" so this audit does
// not re-flag a gap the app already closes.
export const KNOWN_CATEGORY_ALIASES = new Map([
  ["Flatwork", "Concrete"],
  ["Hvac", "HVAC"],
]);

export const EXIT_CODES = { OK: 0, STRUCTURAL_FAILURE: 1, LOAD_ERROR: 2 };
const EXAMPLE_LIMIT = 5;

export function loadCostbookExport(repoRoot = REPO_ROOT) {
  const costbookPath = path.join(repoRoot, "packages/knowledge-engine/exports/json/costbook.json");
  const raw = JSON.parse(fs.readFileSync(costbookPath, "utf8"));
  return { items: Array.isArray(raw.items) ? raw.items : [], assemblies: Array.isArray(raw.assemblies) ? raw.assemblies : [] };
}

export function loadTradeCategories(repoRoot = REPO_ROOT) {
  const tradeProgressPath = path.join(repoRoot, "packages/knowledge-engine/knowledge/knowledge/trade-progress.json");
  const raw = JSON.parse(fs.readFileSync(tradeProgressPath, "utf8"));
  const trades = Array.isArray(raw.trades) ? raw.trades : [];
  return new Set(trades.map((trade) => trade.category));
}

function isFiniteNumeric(value) {
  if (value === null || value === undefined) return false;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed);
}

function addExample(bucket, example) {
  if (bucket.examples.length < EXAMPLE_LIMIT) bucket.examples.push(example);
  bucket.count += 1;
}

function newBucket() {
  return { count: 0, examples: [] };
}

/**
 * Runs the audit against an already-loaded { items, assemblies } export plus
 * the set of known trade category names. Pure/deterministic - no I/O, so it
 * is directly unit-testable against small fixtures.
 */
export function auditCostbook({ items, assemblies }, knownTradeCategories) {
  const findings = {
    // Structural - these can fail the run.
    duplicateItemIds: newBucket(),
    missingIdentityFields: newBucket(),
    nonNumericCostFields: newBucket(),
    duplicateAssemblyIds: newBucket(),
    danglingAssemblyReferences: newBucket(),
    // Data-quality warnings - never fail the run.
    malformedUnits: newBucket(),
    unmappedCategories: newBucket(),
    missingProvenanceStatus: newBucket(),
    missingSourceCitation: newBucket(),
    missingConfidence: newBucket(),
    missingRetrievedAt: newBucket(),
    invalidProvenanceStatus: newBucket(),
    invalidConfidence: newBucket(),
    // Assembly-level counterparts (schema support added 2026-09-10).
    missingAssemblyProvenanceStatus: newBucket(),
    missingAssemblySourceCitation: newBucket(),
    missingAssemblyConfidence: newBucket(),
    missingAssemblyRetrievedAt: newBucket(),
    invalidAssemblyProvenanceStatus: newBucket(),
    invalidAssemblyConfidence: newBucket(),
  };

  const seenItemIds = new Set();
  for (const item of items) {
    const id = typeof item.id === "string" ? item.id : null;
    const label = id ?? `${item.name ?? "(unnamed)"} / ${item.category ?? "(no category)"}`;

    if (!id || !item.name || !item.category) {
      addExample(findings.missingIdentityFields, label);
    }
    if (id) {
      if (seenItemIds.has(id)) addExample(findings.duplicateItemIds, id);
      seenItemIds.add(id);
    }

    for (const field of ["laborCost", "materialCost", "equipmentCost"]) {
      if (!isFiniteNumeric(item[field])) addExample(findings.nonNumericCostFields, `${label}: ${field}=${JSON.stringify(item[field])}`);
    }

    if (item.unit && !KNOWN_UNITS.has(item.unit)) addExample(findings.malformedUnits, `${label}: unit=${item.unit}`);

    if (item.category && !knownTradeCategories.has(item.category) && !KNOWN_CATEGORY_ALIASES.has(item.category)) {
      addExample(findings.unmappedCategories, `${label}: category=${item.category}`);
    }

    if (item.provenanceStatus === undefined) {
      addExample(findings.missingProvenanceStatus, label);
    } else if (!KNOWN_PROVENANCE_STATUS.has(item.provenanceStatus)) {
      addExample(findings.invalidProvenanceStatus, `${label}: provenanceStatus=${item.provenanceStatus}`);
    }

    if (!item.sourceName && !item.sourceUrl && !item.sourceIdentifier) addExample(findings.missingSourceCitation, label);

    if (item.confidence === undefined) {
      addExample(findings.missingConfidence, label);
    } else if (!KNOWN_CONFIDENCE.has(item.confidence)) {
      addExample(findings.invalidConfidence, `${label}: confidence=${item.confidence}`);
    }

    if (!item.retrievedAt) addExample(findings.missingRetrievedAt, label);
  }

  const seenAssemblyIds = new Set();
  const itemIds = new Set(items.map((item) => item.id));
  for (const assembly of assemblies) {
    const id = typeof assembly.id === "string" ? assembly.id : null;
    const label = id ?? `${assembly.name ?? "(unnamed)"} / ${assembly.category ?? "(no category)"}`;
    if (id) {
      if (seenAssemblyIds.has(id)) addExample(findings.duplicateAssemblyIds, id);
      seenAssemblyIds.add(id);
    }
    for (const lineItem of assembly.lineItems ?? []) {
      if (lineItem.costBookItemId && !itemIds.has(lineItem.costBookItemId)) {
        addExample(findings.danglingAssemblyReferences, `${label}: costBookItemId=${lineItem.costBookItemId}`);
      }
    }

    if (assembly.provenanceStatus === undefined) {
      addExample(findings.missingAssemblyProvenanceStatus, label);
    } else if (!KNOWN_PROVENANCE_STATUS.has(assembly.provenanceStatus)) {
      addExample(findings.invalidAssemblyProvenanceStatus, `${label}: provenanceStatus=${assembly.provenanceStatus}`);
    }

    if (!assembly.sourceName && !assembly.sourceUrl && !assembly.sourceIdentifier) {
      addExample(findings.missingAssemblySourceCitation, label);
    }

    if (assembly.confidence === undefined) {
      addExample(findings.missingAssemblyConfidence, label);
    } else if (!KNOWN_CONFIDENCE.has(assembly.confidence)) {
      addExample(findings.invalidAssemblyConfidence, `${label}: confidence=${assembly.confidence}`);
    }

    if (!assembly.retrievedAt) addExample(findings.missingAssemblyRetrievedAt, label);
  }

  const structuralFailureCount =
    findings.duplicateItemIds.count +
    findings.missingIdentityFields.count +
    findings.nonNumericCostFields.count +
    findings.duplicateAssemblyIds.count +
    findings.danglingAssemblyReferences.count;

  return {
    totals: { items: items.length, assemblies: assemblies.length },
    findings,
    structuralFailureCount,
  };
}

function formatBucket(title, bucket, { severity }) {
  if (bucket.count === 0) return `  [ok] ${title}: 0`;
  const exampleList = bucket.examples.map((example) => `      - ${example}`).join("\n");
  const more = bucket.count > bucket.examples.length ? `\n      ... and ${bucket.count - bucket.examples.length} more` : "";
  return `  [${severity}] ${title}: ${bucket.count}\n${exampleList}${more}`;
}

export function formatReport(result) {
  const { totals, findings, structuralFailureCount } = result;
  const lines = [];
  lines.push("Costbook Knowledge Engine provenance/data-quality audit");
  lines.push(`Corpus: ${totals.items} cost items, ${totals.assemblies} assemblies`);
  lines.push("");
  lines.push("Structural (would fail the run if any are present):");
  lines.push(formatBucket("Duplicate cost-item IDs", findings.duplicateItemIds, { severity: "fail" }));
  lines.push(formatBucket("Missing id/name/category", findings.missingIdentityFields, { severity: "fail" }));
  lines.push(formatBucket("Non-numeric cost fields", findings.nonNumericCostFields, { severity: "fail" }));
  lines.push(formatBucket("Duplicate assembly IDs", findings.duplicateAssemblyIds, { severity: "fail" }));
  lines.push(formatBucket("Dangling assembly line-item references", findings.danglingAssemblyReferences, { severity: "fail" }));
  lines.push("");
  lines.push("Data-quality warnings (reported only, never fail the run):");
  lines.push(formatBucket("Units outside the known SF/LF/EA/HR/CY/SQ/CF set", findings.malformedUnits, { severity: "warn" }));
  lines.push(formatBucket("Categories not in trade-progress.json (and not a known alias)", findings.unmappedCategories, { severity: "warn" }));
  lines.push(formatBucket("Items with an invalid provenanceStatus value", findings.invalidProvenanceStatus, { severity: "warn" }));
  lines.push(formatBucket("Items with an invalid confidence value", findings.invalidConfidence, { severity: "warn" }));
  lines.push(formatBucket("Missing item-level provenanceStatus (falls back to trade-level)", findings.missingProvenanceStatus, { severity: "warn" }));
  lines.push(formatBucket("Missing any source citation (sourceName/sourceUrl/sourceIdentifier)", findings.missingSourceCitation, { severity: "warn" }));
  lines.push(formatBucket("Missing confidence", findings.missingConfidence, { severity: "warn" }));
  lines.push(formatBucket("Missing retrievedAt", findings.missingRetrievedAt, { severity: "warn" }));
  lines.push(formatBucket("Assemblies with an invalid provenanceStatus value", findings.invalidAssemblyProvenanceStatus, { severity: "warn" }));
  lines.push(formatBucket("Assemblies with an invalid confidence value", findings.invalidAssemblyConfidence, { severity: "warn" }));
  lines.push(formatBucket("Missing assembly-level provenanceStatus (falls back to trade-level)", findings.missingAssemblyProvenanceStatus, { severity: "warn" }));
  lines.push(formatBucket("Assemblies missing any source citation (sourceName/sourceUrl/sourceIdentifier)", findings.missingAssemblySourceCitation, { severity: "warn" }));
  lines.push(formatBucket("Assemblies missing confidence", findings.missingAssemblyConfidence, { severity: "warn" }));
  lines.push(formatBucket("Assemblies missing retrievedAt", findings.missingAssemblyRetrievedAt, { severity: "warn" }));
  lines.push("");
  lines.push(
    structuralFailureCount === 0
      ? "Result: PASS (no structural defects found)"
      : `Result: FAIL (${structuralFailureCount} structural defect(s) found)`
  );
  return lines.join("\n");
}

function main() {
  try {
    const { items, assemblies } = loadCostbookExport();
    const knownTradeCategories = loadTradeCategories();
    const result = auditCostbook({ items, assemblies }, knownTradeCategories);
    console.log(formatReport(result));
    process.exit(result.structuralFailureCount === 0 ? EXIT_CODES.OK : EXIT_CODES.STRUCTURAL_FAILURE);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(EXIT_CODES.LOAD_ERROR);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
