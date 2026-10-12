"use strict";

/**
 * Resolve a restricted app-role DATABASE_URL without ever returning an admin URL.
 * Shared by the 47802 seed and ABC link-only backfill production workflows.
 * No URLs or credentials should be written to job summaries/logs.
 */
function resolveRestrictedDatabaseUrl(env) {
  const role = (env.APP_DB_ROLE_NAME || "tradeos_app").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(role) ||
      ["postgres", "supabase_admin", "service_role"].includes(role)) {
    throw new Error("Invalid restricted database role");
  }
  const admin = env.DATABASE_ADMIN_URL ? new URL(env.DATABASE_ADMIN_URL) : null;
  if (admin && !["postgres:", "postgresql:"].includes(admin.protocol)) {
    throw new Error("Invalid admin database protocol");
  }
  const adminUser = admin ? decodeURIComponent(admin.username).split(".")[0] : null;
  if (adminUser === role) throw new Error("Restricted role must not equal the administrator");
  let result;
  if (env.DATABASE_URL) {
    result = new URL(env.DATABASE_URL);
  } else {
    if (!admin || !env.APP_DB_ROLE_PASSWORD) {
      throw new Error("Restricted-role connection credentials not configured");
    }
    result = new URL(admin.toString());
    const pooler = result.hostname.endsWith(".pooler.supabase.com");
    const adminUsername = decodeURIComponent(admin.username);
    const suffix = pooler && adminUsername.includes(".")
      ? adminUsername.slice(adminUsername.indexOf("."))
      : "";
    if (pooler && !/^\.[a-z0-9]+$/.test(suffix)) {
      throw new Error("Invalid Supavisor project suffix");
    }
    result.username = role + suffix;
    result.password = env.APP_DB_ROLE_PASSWORD;
  }
  if (!["postgres:", "postgresql:"].includes(result.protocol)) {
    throw new Error("Invalid database protocol");
  }
  const username = decodeURIComponent(result.username);
  const pooler = result.hostname.endsWith(".pooler.supabase.com");
  if (pooler) {
    if (!new RegExp("^" + role + "\\.[a-z0-9]+$").test(username)) {
      throw new Error("Expected restricted role with Supavisor project suffix");
    }
    if (admin) {
      const adminName = decodeURIComponent(admin.username);
      const expectedSuffix = adminName.slice(adminName.indexOf("."));
      if (!adminName.includes(".") || !/^\.[a-z0-9]+$/.test(expectedSuffix) ||
          !username.endsWith(expectedSuffix)) {
        throw new Error("Supavisor project suffix mismatch");
      }
    }
  } else if (username !== role) {
    throw new Error("Database login is not the restricted app role");
  }
  if (!result.password || (admin && result.toString() === admin.toString())) {
    throw new Error("Admin or passwordless connection prohibited");
  }
  return result.toString();
}

module.exports = { resolveRestrictedDatabaseUrl };
if (require.main === module) {
  try {
    const { appendFileSync } = require("node:fs");
    const url = resolveRestrictedDatabaseUrl(process.env);
    // GITHUB_ENV supports multiline escaping with a random delimiter only if not outputting secrets.
    // GitHub masks registered secrets and the derived URL should never appear on stdout.
    const target = process.env.GITHUB_ENV;
    if (!target) throw new Error("GITHUB_ENV is required");
    appendFileSync(target, "DATABASE_URL=" + url + "\n");
  } catch (error) {
    console.error("[restricted-db] " + error.message);
    process.exitCode = 1;
  }
}
