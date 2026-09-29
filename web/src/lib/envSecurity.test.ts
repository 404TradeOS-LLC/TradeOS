import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPublicStorageBucketValue } from "./storage-visibility.ts";

// Framework-free node:test checks (matching settingsAssetUpload.test.ts)
// that pin invariants around server-only secrets and storage privacy defaults.
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
  return [...source.matchAll(IMPORT_SPECIFIER_RE)].map((match) => match[1]);
}

function resolveImport(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else if (specifier.startsWith("@/")) base = path.join(srcRoot, specifier.slice(2));
  else return null;
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
    assert.doesNotMatch(readSource(file), /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*/, `${path.relative(srcRoot, file)} exposes a service-role variable`);
  }
});

test('server-only secret-reading modules (storage.ts, supabase/admin.ts) guard with import "server-only"', () => {
  const candidates = [path.join(srcRoot, "lib", "storage.ts"), path.join(srcRoot, "lib", "supabase", "admin.ts")].filter((file) => fs.existsSync(file));
  assert.deepEqual(candidates.sort(), [path.join(srcRoot, "lib", "storage.ts"), path.join(srcRoot, "lib", "supabase", "admin.ts")].sort());
  for (const file of candidates) assert.match(readSource(file), /^import\s+["']server-only["'];?/m);
});

test('no Client Component ("use client") reaches a server-only module outside a Server Action boundary', () => {
  const clientEntryPoints = allFiles.filter((file) => hasDirective(file, "use client"));
  assert.ok(clientEntryPoints.length > 0);
  const reachable = reachableFrom(clientEntryPoints);
  const forbiddenModules = [path.join(srcRoot, "lib", "storage.ts"), path.join(srcRoot, "lib", "supabase", "admin.ts")].filter((file) => fs.existsSync(file));
  for (const forbidden of forbiddenModules) assert.ok(!reachable.has(forbidden));
  for (const file of reachable) assert.doesNotMatch(readSource(file), /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
});

test("project file storage visibility fails closed unless explicitly true", () => {
  assert.equal(isPublicStorageBucketValue(undefined), false);
  assert.equal(isPublicStorageBucketValue(""), false);
  assert.equal(isPublicStorageBucketValue("false"), false);
  assert.equal(isPublicStorageBucketValue("unexpected"), false);
  assert.equal(isPublicStorageBucketValue(" TRUE "), true);
});

test("private project-file access is session- and project-authorized before Storage download", () => {
  const routeSource = readSource(path.join(srcRoot, "app", "api", "project-files", "[projectId]", "[fileId]", "route.ts"));
  assert.match(routeSource, /getSessionToken\(\)/);
  assert.match(routeSource, /getProject\(token, projectId\)/);
  assert.match(routeSource, /candidate\.id === fileId/);
  assert.match(routeSource, /isGeneratedProjectFileStoragePath\(projectId, file\.storagePath\)/);
  assert.match(routeSource, /download\(file\.storagePath\)/);
  assert.match(routeSource, /data\.size > maxResponseBytes/);
  assert.match(routeSource, /data\.stream\(\)/);
  assert.doesNotMatch(routeSource, /data\.arrayBuffer\(\)/);
  assert.match(routeSource, /Cache-Control["']:\s*["']private, no-store["']/);
});
