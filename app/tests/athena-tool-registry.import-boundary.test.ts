import fs from "node:fs";
import path from "node:path";

// Static import-boundary check (docs/athena/roadmap/
// A2-tool-registry-implementation-plan.md "No Ambient Request Transaction
// For Mutating/Pausable Tools" / "Test Requirements": "a static
// import-boundary check proving app/modules/athena-tool-registry/** and A2
// fixture tools do not import app/db/client, app/db/requestSession, Prisma
// clients, or application services"). This does not prove future business
// tools can't reuse the ambient request transaction - that stronger
// guarantee is an explicit A6 prerequisite. It only proves A2's own registry,
// dispatcher, and fixture modules hold the boundary today.
const ROOT = path.join(__dirname, "..", "modules", "athena-tool-registry");

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

describe("athena tool registry import boundary", () => {
  it("never imports database, Prisma, or application-service seams", () => {
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
