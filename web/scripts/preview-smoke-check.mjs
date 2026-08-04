#!/usr/bin/env node
// Unauthenticated HTTP smoke check for a deployed web/ Preview URL.
//
// This uses Node 20+'s built-in fetch so it can run without adding a browser
// automation dependency. It complements the framework-free source tests by
// checking a running deployment over HTTP.
//
// It does NOT drive a browser and cannot log in (no headless-browser
// dependency exists in web/ to do that with). It only covers what plain
// unauthenticated HTTP requests can prove: redirect-to-login behavior,
// 404 handling, response headers, and secret-leakage scanning of whatever
// HTML/JSON a Preview deployment sends back before authentication. Treat
// this as a first-pass automated gate, NOT a substitute for the manual
// checklist in docs/QA_PREVIEW_DEPLOYMENT_CHECKLIST.md, which also covers
// authenticated routes, three viewports, and console/network inspection
// that only a real browser can do.
//
// Usage:
//   node scripts/preview-smoke-check.mjs <preview-url> [options]
//
// Options:
//   --forbid-host=<substring>           Fail if this substring appears
//                                        anywhere in a response body or
//                                        header. May be repeated.
//
// Exit code is non-zero if any check fails. Intentionally NOT wired into
// `npm test` or CI — it requires a live URL argument and has nothing to
// check until a Preview deployment actually exists.

const args = process.argv.slice(2);
const baseUrlArg = args.find((arg) => !arg.startsWith("--"));
const optionArgs = args.filter((arg) => arg.startsWith("--"));
const unknownOptions = optionArgs.filter((arg) => !arg.startsWith("--forbid-host="));

if (!baseUrlArg) {
  console.error("Usage: node scripts/preview-smoke-check.mjs <preview-url> [--forbid-host=<substring>]...");
  process.exit(2);
}

if (unknownOptions.length > 0) {
  console.error(`Unknown option(s): ${unknownOptions.join(", ")}`);
  process.exit(2);
}

let target;
try {
  target = new URL(baseUrlArg);
} catch {
  console.error(`Invalid Preview URL: ${baseUrlArg}`);
  process.exit(2);
}

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (target.protocol !== "https:" && !(target.protocol === "http:" && localHosts.has(target.hostname))) {
  console.error("Preview URL must use HTTPS (HTTP is allowed only for localhost).");
  process.exit(2);
}

target.pathname = target.pathname.replace(/\/$/, "") + "/";
target.search = "";
target.hash = "";
const baseUrl = target.toString();
const forbidHosts = optionArgs.map((arg) => arg.slice("--forbid-host=".length)).filter(Boolean);

// Patterns that must never appear in an unauthenticated response body or
// header. Mirrors the forbidden-pattern intent of web/src/lib/envSecurity.test.ts
// (SUPABASE_SERVICE_ROLE_KEY is the one secret in this project whose
// browser exposure would be a real vulnerability), extended with a couple
// of generic high-entropy-secret shapes worth a defensive scan at runtime.
const SECRET_PATTERNS = [
  { name: "NEXT_PUBLIC_-prefixed service-role variable name", re: /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*/ },
  { name: "literal SUPABASE_SERVICE_ROLE_KEY reference", re: /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"]?[A-Za-z0-9._-]{20,}/ },
  { name: "literal DATABASE_URL / DATABASE_ADMIN_URL connection string", re: /postgres(?:ql)?:\/\/[^\s"'<>]+:[^\s"'<>]+@/ },
  { name: "literal PLATFORM_PROVISIONING_SECRET reference", re: /PLATFORM_PROVISIONING_SECRET\s*[:=]\s*['"]?[A-Za-z0-9._-]{16,}/ },
];

const ROUTES = [
  // path, expectation
  { path: "/", expect: "redirect-to-login" },
  { path: "/login", expect: "ok" },
  { path: "/signup", expect: "ok" },
  { path: "/dashboard", expect: "redirect-to-login" },
  { path: "/customers", expect: "redirect-to-login" },
  { path: "/projects", expect: "redirect-to-login" },
  { path: "/dispatch", expect: "redirect-to-login" },
  { path: "/settings", expect: "redirect-to-login" },
  { path: "/brand-studio", expect: "redirect-to-login" },
  { path: "/portal/projects/00000000-0000-0000-0000-000000000000", expect: "redirect-to-login" },
  { path: "/this-route-does-not-exist-preview-smoke-check", expect: "not-found" },
];

let failures = 0;

function logResult(ok, label, detail) {
  const marker = ok ? "PASS" : "FAIL";
  if (!ok) failures += 1;
  console.log(`[${marker}] ${label}${detail ? ` — ${detail}` : ""}`);
}

function scanForSecrets(source, label) {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.re.test(source)) {
      logResult(false, `secret scan: ${label}`, `matched "${pattern.name}"`);
      return false;
    }
  }
  logResult(true, `secret scan: ${label}`);
  return true;
}

async function fetchNoRedirect(path) {
  const response = await fetch(new URL(path.replace(/^\//, ""), baseUrl), {
    redirect: "manual",
    headers: { "user-agent": "TradeOS-preview-smoke-check/1.0" },
  });
  const body = await response.text().catch(() => "");
  return { response, body };
}

async function checkRoute({ path, expect }) {
  let response;
  let body;
  try {
    ({ response, body } = await fetchNoRedirect(path));
  } catch (err) {
    logResult(false, `${path} reachable`, err instanceof Error ? err.message : String(err));
    return;
  }

  const status = response.status;
  const location = response.headers.get("location");

  switch (expect) {
    case "ok":
      logResult(status === 200, `${path} returns 200`, `got ${status}`);
      break;
    case "redirect-to-login":
      logResult(
        status >= 300 && status < 400 && !!location && location.includes("/login"),
        `${path} redirects unauthenticated requests to /login`,
        `got ${status} location=${location ?? "(none)"}`
      );
      break;
    case "not-found":
      logResult(status === 404, `${path} returns 404`, `got ${status}`);
      break;
    default:
      throw new Error(`unknown expectation: ${expect}`);
  }

  scanForSecrets(body, path);
  const responseHeaders = [...response.headers.entries()].map(([name, value]) => `${name}: ${value}`).join("\n");
  scanForSecrets(responseHeaders, `${path} response headers`);

  for (const forbidHost of forbidHosts) {
    const combined = `${body}\n${[...response.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n")}`;
    logResult(!combined.includes(forbidHost), `${path} does not leak forbidden host "${forbidHost}"`);
  }

  return { status, location, body };
}

async function main() {
  console.log(`Preview smoke check against: ${baseUrl}\n`);

  for (const route of ROUTES) {
    await checkRoute(route);
  }

  console.log("\n--- Reminder ---");
  console.log("This script only covers unauthenticated HTTP behavior. It cannot log in,");
  console.log("cannot check three-viewport rendering, and cannot read browser console or");
  console.log("network activity. Run the full manual checklist");
  console.log("(docs/QA_PREVIEW_DEPLOYMENT_CHECKLIST.md) for authenticated routes,");
  console.log("responsive layout checks, and console/network inspection.");

  console.log(`\n${failures === 0 ? "All automated checks passed." : `${failures} automated check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
