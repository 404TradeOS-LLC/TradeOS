#!/usr/bin/env node
// Unauthenticated HTTP smoke check for a deployed web/ Preview URL, plus
// (optionally) the staging backend it points at.
//
// This uses Node 20+'s built-in fetch so it can run without adding a browser
// automation dependency. It complements the framework-free source tests by
// checking a running deployment over HTTP.
//
// It does NOT drive a browser and cannot log in (no headless-browser
// dependency exists in web/ to do that with). It only covers what plain
// unauthenticated HTTP requests can prove: redirect-to-login behavior,
// 404 handling, response headers, backend health/readiness, and
// secret-leakage / forbidden-host scanning. Treat this as a first-pass
// automated gate, NOT a substitute for the manual checklist in
// docs/QA_PREVIEW_DEPLOYMENT_CHECKLIST.md, which also covers authenticated
// routes, three viewports, and console/network inspection that only a real
// browser can do.
//
// Usage:
//   node scripts/preview-smoke-check.mjs <preview-url> [options]
//   PREVIEW_URL=<preview-url> [BACKEND_URL=<backend-url>] node scripts/preview-smoke-check.mjs [options]
//
// The positional argument (if given) wins over PREVIEW_URL, so existing
// invocations — including the one documented in
// docs/QA_PREVIEW_DEPLOYMENT_CHECKLIST.md — keep working unchanged.
// BACKEND_URL is optional; when set, the backend /health and /ready checks
// (see "Backend checks" below) run in addition to the frontend route checks.
//
// Options:
//   --forbid-host=<substring>           Fail if this substring appears
//                                        anywhere in a response body or
//                                        header. May be repeated. Always
//                                        includes api.404tradeos.com and
//                                        kssaceuetdjwfqnbzhly.supabase.co
//                                        (Production's backend origin and
//                                        Supabase project ref) — Preview
//                                        must never reach either, so this
//                                        isn't opt-in.
//
// Exit code is non-zero if any check fails.

const ALWAYS_FORBIDDEN_HOSTS = ["api.404tradeos.com", "kssaceuetdjwfqnbzhly.supabase.co"];

const args = process.argv.slice(2);
const positionalArg = args.find((arg) => !arg.startsWith("--"));
const optionArgs = args.filter((arg) => arg.startsWith("--"));
const unknownOptions = optionArgs.filter((arg) => !arg.startsWith("--forbid-host="));
const baseUrlArg = positionalArg ?? process.env.PREVIEW_URL;
const backendUrlArg = process.env.BACKEND_URL;

if (!baseUrlArg) {
  console.error(
    "Usage: node scripts/preview-smoke-check.mjs <preview-url> [--forbid-host=<substring>]...\n" +
      "   or: PREVIEW_URL=<preview-url> [BACKEND_URL=<backend-url>] node scripts/preview-smoke-check.mjs"
  );
  process.exit(2);
}

if (unknownOptions.length > 0) {
  console.error(`Unknown option(s): ${unknownOptions.join(", ")}`);
  process.exit(2);
}

// Environment-safety pre-flight: fail before making a single network call if
// either configured URL is itself a forbidden Production host. This is the
// one check that must never depend on a live response — a misconfigured
// BACKEND_URL pointed at Production shouldn't need a successful request to
// be caught.
for (const [label, value] of [["PREVIEW_URL", baseUrlArg], ["BACKEND_URL", backendUrlArg]]) {
  if (!value) continue;
  for (const forbidden of ALWAYS_FORBIDDEN_HOSTS) {
    if (value.includes(forbidden)) {
      console.error(`[FAIL] environment safety: ${label} contains forbidden Production host "${forbidden}"`);
      console.error(`${label} must point at a staging deployment, never Production.`);
      process.exit(1);
    }
  }
}

let target;
try {
  target = new URL(baseUrlArg);
} catch {
  console.error(`Invalid Preview URL: ${baseUrlArg}`);
  process.exit(2);
}

let backendTarget;
if (backendUrlArg) {
  try {
    backendTarget = new URL(backendUrlArg);
  } catch {
    console.error(`Invalid BACKEND_URL: ${backendUrlArg}`);
    process.exit(2);
  }
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
const backendBaseUrl = backendTarget ? backendTarget.toString().replace(/\/$/, "") : undefined;
const forbidHosts = [...ALWAYS_FORBIDDEN_HOSTS, ...optionArgs.map((arg) => arg.slice("--forbid-host=".length)).filter(Boolean)];

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

// Next.js App Router's redirect() thrown inside a streamed/PPR Server
// Component render doesn't always produce a classic top-level 3xx: the
// static shell can be served as 200 while a dynamic hole resolves and
// signals the redirect through the streamed RSC payload instead. That
// payload embeds a "NEXT_REDIRECT;<type>;<path>;<statusCode>;" digest, and
// the document also carries a <meta http-equiv="refresh"> fallback
// (id="__next-page-redirect") for clients that never run the JS. Either
// marker pointing at /login means the auth boundary held even though the
// wire-level status code is 200, not 3xx.
const NEXT_REDIRECT_DIGEST_TO_LOGIN_RE = /NEXT_REDIRECT[^"']*;\/login;\d+/;
const META_REFRESH_TO_LOGIN_RE = /http-equiv=\\?"refresh\\?"[^>]*url=\/login/i;

function isStreamedRedirectToLogin(body) {
  return NEXT_REDIRECT_DIGEST_TO_LOGIN_RE.test(body) || META_REFRESH_TO_LOGIN_RE.test(body);
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
    case "redirect-to-login": {
      const isClassicRedirect = status >= 300 && status < 400 && !!location && location.includes("/login");
      const isStreamedRedirect = status === 200 && isStreamedRedirectToLogin(body);
      logResult(
        isClassicRedirect || isStreamedRedirect,
        `${path} redirects unauthenticated requests to /login`,
        isClassicRedirect ? `got ${status} location=${location}` : isStreamedRedirect ? `got ${status} with a streamed redirect to /login` : `got ${status} location=${location ?? "(none)"}`
      );
      break;
    }
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

async function checkBackendJson(path, describe) {
  const url = `${backendBaseUrl}${path}`;
  let response;
  let body;
  let json;
  try {
    response = await fetch(url, { headers: { "user-agent": "TradeOS-preview-smoke-check/1.0" } });
    body = await response.text();
  } catch (err) {
    logResult(false, `backend ${path} reachable`, err instanceof Error ? err.message : String(err));
    return;
  }

  try {
    json = JSON.parse(body);
  } catch {
    logResult(false, `backend ${path} returns valid JSON`, `got non-JSON body (status ${response.status})`);
    return;
  }

  describe(response.status, json);
  scanForSecrets(body, `backend ${path}`);

  for (const forbidHost of forbidHosts) {
    logResult(!body.includes(forbidHost), `backend ${path} does not leak forbidden host "${forbidHost}"`);
  }
}

async function checkBackend() {
  if (!backendBaseUrl) return;

  console.log(`\nBackend checks against: ${backendBaseUrl}`);

  await checkBackendJson("/health", (status, json) => {
    logResult(status === 200 && json.status === "ok", "/health reports ok", `got status ${status}, body.status=${json.status}`);
  });

  await checkBackendJson("/ready", (status, json) => {
    const dbStatus = json.checks?.database?.status;
    logResult(status === 200 && dbStatus === "ok", "/ready reports database ok", `got status ${status}, database.status=${dbStatus}`);
  });
}

async function main() {
  console.log(`Preview smoke check against: ${baseUrl}\n`);

  for (const route of ROUTES) {
    await checkRoute(route);
  }

  await checkBackend();

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
