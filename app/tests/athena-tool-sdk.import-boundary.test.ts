import fs from "node:fs";
import path from "node:path";

// Static import-boundary check (docs/athena/roadmap/
// A9-tool-sdk-implementation-plan.md, mirroring app/tests/
// athena-tool-registry.import-boundary.test.ts). Two distinct boundaries:
//
// - SDK core files (defineTool.ts, results.ts, warnings.ts, followUps.ts,
//   events.ts, contractTestKit.ts, index.ts, types.ts) never import Prisma,
//   the database, or ANY application service module - the SDK's authoring
//   machinery must stay generic and not hardcode a dependency on any one
//   service.
// - fixtures/ (this milestone's reference tool) is a real first-party tool
//   and is *expected* to import an application-service module type
//   (athena-memory/service.ts) via explicit dependency injection - that is
//   the architecture A9 exists to make easy (see fixtures/
//   recallPreferenceTool.ts's module comment). It must still never import
//   Prisma or the database directly, per this plan's "Explicit A9
//   exclusions": "no direct DB API for tools."
const ROOT = path.join(__dirname, "..", "modules", "athena-tool-sdk");
const FIXTURES_DIR = path.join(ROOT, "fixtures");

const PRISMA_DB_PATTERNS: RegExp[] = [/db\/client/, /db\/requestSession/, /@prisma\/client/];
const SERVICE_PATTERN = /modules\/[^/'"]+\/service/;

function collectTsFiles(dir: string, options: { exclude?: string[] } = {}): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (options.exclude?.includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsFiles(full, options);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importFromPattern = /import\s+(?:type\s+)?[^;]*?from\s+["']([^"']+)["']/g;
  const requirePattern = /require\(\s*["']([^"']+)["']\s*\)/g;
  for (const pattern of [importFromPattern, requirePattern]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

describe("athena-tool-sdk import boundary", () => {
  it("core SDK modules never import database, Prisma, or any application-service module", () => {
    const files = collectTsFiles(ROOT, { exclude: ["fixtures"] });
    expect(files.length).toBeGreaterThan(0);

    const forbidden = [...PRISMA_DB_PATTERNS, SERVICE_PATTERN];
    const violations: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const specifier of importSpecifiers(source)) {
        if (forbidden.some((pattern) => pattern.test(specifier))) {
          violations.push(`${path.relative(ROOT, file)} imports forbidden specifier: ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("the reference fixture tool never imports database or Prisma directly (application-service imports are expected)", () => {
    const files = collectTsFiles(FIXTURES_DIR);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const specifier of importSpecifiers(source)) {
        if (PRISMA_DB_PATTERNS.some((pattern) => pattern.test(specifier))) {
          violations.push(`${path.relative(ROOT, file)} imports forbidden specifier: ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("the reference fixture tool depends on an application service only through an explicit, type-only injected interface (no factory/Prisma import)", () => {
    // Inspects only literal `import` lines, not prose comments, so this
    // check can't be defeated (or falsely tripped) by explanatory text
    // elsewhere in the file that merely mentions a factory/Prisma symbol by
    // name without importing it.
    const source = fs.readFileSync(path.join(FIXTURES_DIR, "recallPreferenceTool.ts"), "utf8");
    const importLines = source.split("\n").filter((line) => line.trim().startsWith("import"));

    const serviceImportLines = importLines.filter((line) => /athena-memory\/service/.test(line));
    expect(serviceImportLines).toHaveLength(1);
    expect(serviceImportLines[0].trim().startsWith("import type ")).toBe(true);

    expect(importLines.some((line) => /athena-memory\/store/.test(line))).toBe(false);
  });
});
