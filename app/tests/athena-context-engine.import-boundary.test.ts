import fs from "node:fs";
import path from "node:path";

// Static import-boundary check (docs/athena/roadmap/
// A3-context-engine-implementation-plan.md "Required Backend Seams" /
// "Test Requirements"). Mirrors athena-tool-registry.import-boundary.test.ts.
// Providers are allowed to import application services (JobsService,
// KnowledgeRuntimeService) - that is the whole point of a context provider
// - but never the database/Prisma seams directly. This proves A3's own
// registry/assembler/provider modules hold that boundary today; it does not
// prove a future business-context provider will.
const ROOT = path.join(__dirname, "..", "modules", "athena-context-engine");

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [/db\/client/, /db\/requestSession/, /@prisma\/client/];

function collectTsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsFiles(full);
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

describe("athena context engine import boundary", () => {
  it("never imports the database or Prisma directly", () => {
    const files = collectTsFiles(ROOT);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const specifier of importSpecifiers(source)) {
        if (FORBIDDEN_IMPORT_PATTERNS.some((pattern) => pattern.test(specifier))) {
          violations.push(`${path.relative(ROOT, file)} imports forbidden specifier: ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
