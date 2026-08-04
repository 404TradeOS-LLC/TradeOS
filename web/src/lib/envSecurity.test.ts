import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Framework-free node:test checks (matching settingsAssetUpload.test.ts)
// that pin
// invariants around SUPABASE_SERVICE_ROLE_KEY, the one secret in this
// project whose exposure to the browser would be a real vulnerability
// (every other Supabase var and BACKEND_API_URL is either already
// NEXT_PUBLIC_ or points at nothing more sensitive than a self-hosted API
// base URL).
//
// These are static source-text checks, not behavioral tests: nothing here
// imports/executes web/src/lib/storage.ts or web/src/lib/supabase/* (they
// pull in next/headers and other Next-runtime-only APIs that don't run
// under plain `node --test`). Reading files as text and asserting on their
// shape is deliberate: these imports require Next server runtime APIs.

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(here, ".."); // web/src

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

const allFiles = walk(srcRoot);

const sourceCache = new Map<string, string>();
function readSource(file: string): string {
  const cached = sourceCache.get(file);
  if (cached !== undefined) return cached;
  const source = fs.readFileSync(file, "utf8");
  sourceCache.set(file, source);
  return source;
}

const IMPORT_SPECIFIER_RE = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;

function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER_RE)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

// Resolves a relative ("./x") or aliased ("@/x") import specifier to one of
// this walk's known web/src files. Returns null for external packages
// (no leading "." or "@/") or for anything that resolves outside web/src
// (e.g. web/src/domain re-exports ../../../app/domain — intentionally not
// traced further, since app/domain holds no secrets and lives outside this
// project's own source tree).
function resolveImport(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else if (specifier.startsWith("@/")) {
    base = path.join(srcRoot, specifier.slice(2));
  } else {
    return null;
  }

  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
  return candidates.find((candidate) => allFiles.includes(candidate)) ?? null;
}

function hasDirective(file: string, directive: "use client" | "use server"): boolean {
  const firstLines = readSource(file).split("\n").slice(0, 5).join("\n");
  return new RegExp(`^\\s*["']${directive}["'];?\\s*$`, "m").test(firstLines);
}

function reachableFrom(startFiles: string[]): Set<string> {
  const visited = new Set<string>();
  const queue = [...startFiles];
  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);

    // Next.js replaces imports of a "use server" module from Client
    // Components with references to Server Actions. Its implementation and
    // dependencies are not part of the client bundle, so do not cross this
    // explicit boundary while tracing the browser-visible graph.
    if (hasDirective(file, "use server")) continue;

    for (const specifier of extractImportSpecifiers(readSource(file))) {
      const resolved = resolveImport(file, specifier);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return visited;
}

test("SUPABASE_SERVICE_ROLE_KEY never appears in a NEXT_PUBLIC_-prefixed form anywhere in web/src", () => {
  for (const file of allFiles) {
    assert.doesNotMatch(
      readSource(file),
      /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*/,
      `${path.relative(srcRoot, file)} references a NEXT_PUBLIC_-prefixed service-role variable — this would ship the secret to the browser`
    );
  }
});

test('server-only secret-reading modules (storage.ts, supabase/admin.ts) guard with import "server-only"', () => {
  const candidates = [path.join(srcRoot, "lib", "storage.ts"), path.join(srcRoot, "lib", "supabase", "admin.ts")].filter((file) =>
    fs.existsSync(file)
  );

  assert.deepEqual(
    candidates.sort(),
    [path.join(srcRoot, "lib", "storage.ts"), path.join(srcRoot, "lib", "supabase", "admin.ts")].sort(),
    "expected both current server-only secret-reading modules to exist"
  );

  for (const file of candidates) {
    assert.match(
      readSource(file),
      /^import\s+["']server-only["'];?/m,
      `${path.relative(srcRoot, file)} reads a server-only secret but is missing a top-of-file "server-only" import guard`
    );
  }
});

test('no Client Component ("use client") reaches a server-only module outside a Server Action boundary', () => {
  const clientEntryPoints = allFiles.filter((file) => hasDirective(file, "use client"));
  assert.ok(clientEntryPoints.length > 0, "expected to find at least one \"use client\" file to anchor this check");

  const reachable = reachableFrom(clientEntryPoints);

  const forbiddenModules = [path.join(srcRoot, "lib", "storage.ts"), path.join(srcRoot, "lib", "supabase", "admin.ts")].filter((file) =>
    fs.existsSync(file)
  );

  for (const forbidden of forbiddenModules) {
    assert.ok(
      !reachable.has(forbidden),
      `${path.relative(srcRoot, forbidden)} is reachable from a "use client" component's import graph — its server-only secret would be bundled for the browser`
    );
  }

  for (const file of reachable) {
    assert.doesNotMatch(
      readSource(file),
      /process\.env\.SUPABASE_SERVICE_ROLE_KEY/,
      `${path.relative(srcRoot, file)} is reachable from a Client Component and reads SUPABASE_SERVICE_ROLE_KEY directly`
    );
  }
});
