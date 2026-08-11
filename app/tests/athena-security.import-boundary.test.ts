import fs from "node:fs";
import path from "node:path";

// Static import-boundary check, following the same pattern as every sibling
// module's import-boundary test (e.g. athena-tool-registry.import-boundary.test.ts).
// athena-security is deliberately designed as a leaf module (docs/athena/
// roadmap/A11-security-hardening-implementation-plan.md): "an additive
// app/modules/athena-security/ ... layer with zero dependencies on any
// sibling Athena module - other modules call into it." This test proves
// that design holds, not just that it avoids db/Prisma/service access -
// a dependency on athena-kernel, athena-permissions, athena-memory, etc.
// would risk a circular import once those modules import athena-security
// (which several now do).
const ROOT = path.join(__dirname, "..", "modules", "athena-security");

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [/db\/client/, /db\/requestSession/, /@prisma\/client/, /modules\/[^/'"]+\/service/, /modules\/athena-(?!security)/];

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

describe("athena security import boundary", () => {
  it("never imports database, Prisma, application-service, or sibling Athena module seams", () => {
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
