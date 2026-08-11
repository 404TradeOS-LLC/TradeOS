import fs from "node:fs";
import path from "node:path";

// Static import-boundary check, mirroring athena-memory.import-boundary.test.ts
// and athena-permissions.import-boundary.test.ts. Only store.ts may import
// Prisma/db/client - publisher.ts, dispatch.ts, replay.ts, service.ts,
// registry.ts, types.ts, validation.ts, and every fixture reach persistence
// exclusively through the AthenaEventRepository interface.
const ROOT = path.join(__dirname, "..", "modules", "athena-events");

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [/db\/client/, /db\/requestSession/, /@prisma\/client/];
const ALLOWED_FILES = new Set(["store.ts"]);

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

describe("athena events import boundary", () => {
  it("never imports the database or Prisma directly outside store.ts", () => {
    const files = collectTsFiles(ROOT);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const relative = path.relative(ROOT, file);
      if (ALLOWED_FILES.has(relative)) continue;
      const source = fs.readFileSync(file, "utf8");
      for (const specifier of importSpecifiers(source)) {
        if (FORBIDDEN_IMPORT_PATTERNS.some((pattern) => pattern.test(specifier))) {
          violations.push(`${relative} imports forbidden specifier: ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("store.ts is the only file importing Prisma", () => {
    const source = fs.readFileSync(path.join(ROOT, "store.ts"), "utf8");
    expect(importSpecifiers(source)).toEqual(expect.arrayContaining(["@prisma/client", "../../db/client"]));
  });
});
