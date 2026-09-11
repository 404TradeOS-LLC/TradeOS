import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..", "modules", "athena-plugin-sdk");
const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  /db\/client/,
  /db\/requestSession/,
  /@prisma\/client/,
  /modules\/[^/'"]+\/service/,
];

function collectTsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /import\s+(?:type\s+)?[^;]*?from\s+["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

function forbiddenSpecifiers(source: string): string[] {
  return importSpecifiers(source).filter((specifier) => FORBIDDEN_IMPORT_PATTERNS.some((pattern) => pattern.test(specifier)));
}

describe("athena plugin SDK import boundary", () => {
  it("detects standard, side-effect, dynamic, and require imports", () => {
    const source = [
      'import value from "../db/client";',
      'import "../db/requestSession";',
      'const prisma = await import("@prisma/client");',
      'const service = require("../../modules/billing/service");',
    ].join("\n");
    expect(forbiddenSpecifiers(source)).toEqual([
      "../db/client",
      "../db/requestSession",
      "@prisma/client",
      "../../modules/billing/service",
    ]);
  });

  it("does not import Prisma, database sessions, or application services directly", () => {
    const files = collectTsFiles(ROOT);
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const specifier of forbiddenSpecifiers(source)) {
        violations.push(`${path.relative(ROOT, file)} imports forbidden specifier: ${specifier}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
