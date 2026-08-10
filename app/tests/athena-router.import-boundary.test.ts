import fs from "node:fs";
import path from "node:path";

// Static import-boundary check, mirroring athena-permissions.import-boundary.test.ts
// and its siblings. The router is a pure message classifier - it needs
// none of the database, Prisma, or application-service seams.
const ROOT = path.join(__dirname, "..", "modules", "athena-router");

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [/db\/client/, /db\/requestSession/, /@prisma\/client/, /modules\/[^/'"]+\/service/];

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

describe("athena router import boundary", () => {
  it("never imports the database, Prisma, or application services", () => {
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
