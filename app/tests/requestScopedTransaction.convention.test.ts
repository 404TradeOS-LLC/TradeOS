import fs from "node:fs";
import path from "node:path";

// Regression coverage for a production incident: databaseSession middleware
// (db/requestSession.ts) wraps every authenticated request in a
// Prisma.TransactionClient via AsyncLocalStorage, and the proxied `prisma`
// export (db/client.ts) resolves to that active transaction client whenever
// one is set. Prisma.TransactionClient has no $transaction method, so any
// code that calls the proxied `prisma` import's `.$transaction(...)`
// directly throws "TypeError: ...prisma.$transaction is not a function" the
// first time it actually runs inside a request - confirmed in production
// logs against PATCH /api/v1/settings, and present unexercised in
// crm/service.ts, brand-studio/service.ts, and
// projectTasks.controller.ts. The fix is always runInDatabaseTransaction(),
// which reuses the active request transaction instead of nesting a new one.
const ROOTS = ["backend", "modules"].map((dir) => path.join(__dirname, "..", dir));
const FORBIDDEN_PATTERN = /\bprisma\.\$transaction\(/;

function collectTsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsFiles(full);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("request-scoped transaction convention", () => {
  it("never calls the proxied prisma client's $transaction directly; use runInDatabaseTransaction instead", () => {
    const appRoot = path.join(__dirname, "..");
    const violations: string[] = [];

    for (const root of ROOTS) {
      for (const file of collectTsFiles(root)) {
        const source = fs.readFileSync(file, "utf8");
        if (FORBIDDEN_PATTERN.test(source)) {
          violations.push(path.relative(appRoot, file));
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
