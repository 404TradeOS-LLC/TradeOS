import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Narrow reconciliation comparison for the historical invoice expand SQL.
// Strip whole-line comments and normalize whitespace only. Do not strip
// literals, reorder statements, remove semicolons, or ignore SQL expressions.
export function executableSql(sql) {
  if (typeof sql !== "string" || !sql.trim()) throw new Error("Migration SQL is empty");
  return sql.replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function assertEquivalentSql(supabaseSql, prismaSql) {
  const applied = executableSql(supabaseSql);
  const tracked = executableSql(prismaSql);
  if (!applied || !tracked || applied !== tracked) {
    throw new Error("Supabase invoice expand SQL differs from tracked Prisma migration; refusing ledger reconciliation");
  }
}

const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  if (process.argv.length !== 4) {
    console.error("Usage: node verify-staging-invoice-expand.mjs applied.sql tracked.sql");
    process.exit(2);
  }
  try {
    assertEquivalentSql(readFileSync(process.argv[2], "utf8"), readFileSync(process.argv[3], "utf8"));
    console.log("Invoice expand executable SQL matches the tracked Prisma migration.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invoice expand verification failed");
    process.exit(1);
  }
}
