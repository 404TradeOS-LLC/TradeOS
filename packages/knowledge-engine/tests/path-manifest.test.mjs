// Focused structural test proving path-manifest.json matches on-disk reality.
// Run with: node --test packages/knowledge-engine/tests/path-manifest.test.mjs
// Stdlib only (node:test, node:assert), no new dependency -- mirrors the existing repo
// pattern in scripts/__tests__/docs-check.test.mjs. Read-only: only checks existence, never
// writes, moves, or deletes anything.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");

const manifest = JSON.parse(
  readFileSync(path.join(packageRoot, "path-manifest.json"), "utf8"),
);

function repoPath(relative) {
  return path.join(repoRoot, relative);
}

describe("path-manifest.json — canonical roots exist on disk", () => {
  for (const [name, relativePath] of Object.entries(manifest.canonicalRoots)) {
    test(`${name} (${relativePath}) exists`, () => {
      assert.equal(existsSync(repoPath(relativePath)), true, `expected ${relativePath} to exist`);
      assert.equal(statSync(repoPath(relativePath)).isDirectory(), true, `expected ${relativePath} to be a directory`);
    });
  }
});

describe("path-manifest.json — runtime-critical assets", () => {
  for (const asset of manifest.runtimeCriticalAssets) {
    const exists = existsSync(repoPath(asset.path));
    if (asset.required) {
      test(`required asset ${asset.path} exists`, () => {
        assert.equal(exists, true, `required asset ${asset.path} is missing`);
      });
    } else {
      test(`optional asset ${asset.path} presence is recorded accurately`, () => {
        // Not asserting existence (optional assets are allowed to be absent) -- only that the
        // manifest's own contentParsed/required flags are internally consistent booleans, so a
        // future edit can't silently corrupt the schema.
        assert.equal(typeof asset.required, "boolean");
        assert.equal(typeof asset.contentParsed, "boolean");
      });
    }
  }
});

describe("path-manifest.json — deprecated roots are real, and are not the canonical export root", () => {
  for (const deprecated of manifest.deprecatedRoots) {
    test(`${deprecated.path} exists on disk (it should — it's deprecated, not deleted)`, () => {
      assert.equal(existsSync(repoPath(deprecated.path)), true, `expected deprecated path ${deprecated.path} to still exist`);
    });

    test(`${deprecated.path} is never equal to the canonical exports root`, () => {
      const canonicalExports = repoPath(manifest.canonicalRoots.exportsRoot);
      assert.notEqual(path.resolve(repoPath(deprecated.path)), path.resolve(canonicalExports));
    });
  }
});

describe("path-manifest.json — the duplicate tree is documented as prohibited, not deleted", () => {
  const duplicate = manifest.deprecatedRoots.find((entry) => entry.path.endsWith("knowledge-engine/knowledge-engine"));

  test("the nested duplicate tree entry exists in the manifest", () => {
    assert.ok(duplicate, "expected a deprecatedRoots entry for packages/knowledge-engine/knowledge-engine");
  });

  test("the manifest's tracked file counts are plausible (both non-zero, same order of magnitude)", () => {
    const { duplicate: dupCount, canonical: canonicalCount } = duplicate.trackedFileCount;
    assert.ok(dupCount > 1000, "expected the duplicate tree file count to be in the thousands");
    assert.ok(canonicalCount > 1000, "expected the canonical tree file count to be in the thousands");
    assert.ok(
      Math.abs(dupCount - canonicalCount) < 50,
      "expected the duplicate and canonical file counts to be very close (they diverge only by Phase A's own new files)",
    );
  });

  test("removal is gated on explicit prerequisites, not marked safe", () => {
    assert.ok(Array.isArray(duplicate.removalPrerequisites));
    assert.ok(duplicate.removalPrerequisites.length > 0);
    assert.ok(duplicate.removalPrerequisites.some((p) => /founder/i.test(p)), "expected founder sign-off to be a listed prerequisite");
  });
});

describe("path-manifest.json — compatibility fallback status matches the reference audit", () => {
  test("fallback is explicitly recorded as not needed, with evidence", () => {
    assert.equal(manifest.compatibilityFallback.status, "not_needed");
    assert.equal(typeof manifest.compatibilityFallback.evidence, "string");
    assert.ok(manifest.compatibilityFallback.evidence.length > 0);
  });
});

describe("path-manifest.json — unresolved risks are documented, not silently dropped", () => {
  test("at least one unresolved risk is recorded", () => {
    assert.ok(Array.isArray(manifest.unresolvedRisks));
    assert.ok(manifest.unresolvedRisks.length > 0);
  });

  for (const risk of manifest.unresolvedRisks) {
    test(`risk "${risk.id}" has a status and is not silently marked fixed`, () => {
      assert.ok(risk.status, `risk ${risk.id} is missing a status`);
      assert.notEqual(risk.status, "fixed");
    });
  }
});
