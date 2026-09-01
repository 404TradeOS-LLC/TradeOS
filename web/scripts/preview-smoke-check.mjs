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
//   --require-backend-host=<substring>  Fail unless BACKEND_URL's hostname
//                                        contains this substring. Use this
//                                        for a deployment that MUST point at
//                                        one specific backend (e.g. an RC/
//                                        beta frontend Preview that must
//                                        reach its own dedicated RC backend
//                                        deployment, not the shared staging
//                                        backend every ordinary PR Preview
//                                        uses) — a misconfigured
//                                        BACKEND_API_URL that silently
//                                        reverts to some other backend
//                                        (staging included) fails this check
//                                        instead of passing quietly. Ordinary
//                                        Preview smoke checks that
//                                        intentionally target the shared
//                                        staging backend should omit this
//                                        flag. May be given at most once.
//
// Exit code is non-zero if any check fails.

const ALWAYS_FORBIDDEN_HOSTS = ["api.404tradeos.com", "kssaceuetdjwfqnbzhly.supabase.co"];
const FETCH_TIMEOUT_MS = 10_000;

function containsForbiddenHost(value, hosts) {
  const lower = value.toLowerCase();
  return hosts.some((host) => lower.includes(host.toLowerCase()));
}

function normalizedHostname(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

function targetsForbiddenHost(value, hosts) {
  const hostname = normalizedHostname(value);
  return hostname !== null && hosts.some((host) => hostname === host.toLowerCase().replace(/\.$/, ""));
}

const args = process.argv.slice(2);
const positionalArg = args.find((arg) => !arg.startsWith("--"));
const optionArgs = args.filter((arg) => arg.startsWith("--"));
const forbidHostArgs = optionArgs.filter((arg) => arg.startsWith("--forbid-host="));
const requireBackendHostArgs = optionArgs.filter((arg) => arg.startsWith("--require-backend-host="));
const unknownOptions = optionArgs.filter((arg) => !arg.startsWith("--forbid-host=") && !arg.startsWith("--require-backend-host="));
const baseUrlArg = positionalArg ?? process.env.PREVIEW_URL;
const backendUrlArg = process.env.BACKEND_URL;

if (!baseUrlArg) {
  console.error(
    "Usage: node scripts/preview-smoke-check.mjs <preview-url> [--forbid-host=<substring>]... [--require-backend-host=<substring>]\n" +
      "   or: PREVIEW_URL=<preview-url> [BACKEND_URL=<backend-url>] node scripts/preview-smoke-check.mjs"
  );
  process.exit(2);
}

if (unknownOptions.length > 0) {
  console.error(`Unknown option(s): ${unknownOptions.join(", ")}`);
  process.exit(2);
}

if (requireBackendHostArgs.length > 1) {
  console.error("--require-backend-host may be given at most once.");
  process.exit(2);
}

const requireBackendHost = requireBackendHostArgs[0]?.slice("--require-backend-host=".length) || undefined;

if (requireBackendHostArgs.length === 1 && !requireBackendHost) {
  console.error("--require-backend-host requires a non-empty substring.");
  process.exit(2);
}

if (requireBackendHost && !backendUrlArg) {
  console.error("--require-backend-host requires BACKEND_URL to be set.");
  process.exit(2);
}

// Environment-safety pre-flight: fail before making a single network call if
// either configured URL is itself a forbidden Production host. This is the
// one check that must never depend on a live response — a misconfigured
// BACKEND_URL pointed at Production shouldn't need a successful request to
// be caught.
for (const [label, value] of [["PREVIEW_URL", baseUrlArg], ["BACKEND_URL", backendUrlArg]]) {
  if (!value) continue;
  if (targetsForbiddenHost(value, ALWAYS_FORBIDDEN_HOSTS)) {
    console.error(`[FAIL] environment safety: ${label} contains a forbidden Production host`);
    console.error(`${label} must point at a staging deployment, never Production.`);
    process.exit(1);
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
const forbidHosts = [...ALWAYS_FORBIDDEN_HOSTS, ...forbidHostArgs.map((arg) => arg.slice("--forbid-host=".length)).filter(Boolean)];

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
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body = await response.text();
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

  const responseHeaders = [...response.headers.entries()].map(([name, value]) => `${name}: ${value}`).join("\n");
  scanForSecrets(body, path);
  scanForSecrets(responseHeaders, `${path} response headers`);

  for (const forbidHost of forbidHosts) {
    logResult(!containsForbiddenHost(`${body}\n${responseHeaders}`, [forbidHost]), `${path} does not leak forbidden host "${forbidHost}"`);
  }

  return { status, location, body };
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function checkBackendJson(path, describe) {
  const url = `${backendBaseUrl}${path}`;

  // 1. Fetch. Manual redirect handling — a backend health check must never
  // silently follow a redirect (e.g. Vercel's own auth/protection layer
  // intercepting the request) and mistake the redirect target's response
  // for the backend's own.
  let response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "TradeOS-preview-smoke-check/1.0" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    logResult(false, `backend ${path} reachable`, isTimeout ? `timed out after ${FETCH_TIMEOUT_MS}ms` : err instanceof Error ? err.message : String(err));
    return;
  }

  // 2/3. Capture status, headers, and raw text before any parsing.
  const status = response.status;
  const location = response.headers.get("location");
  const headersCombined = [...response.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
  let body;
  try {
    body = await response.text();
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    logResult(false, `backend ${path} body readable`, isTimeout ? `timed out after ${FETCH_TIMEOUT_MS}ms` : err instanceof Error ? err.message : String(err));
    return;
  }

  // 4. Security scanning runs against the raw text regardless of whether it
  // turns out to be valid JSON — a non-JSON error body can leak a secret
  // just as easily as a JSON one.
  scanForSecrets(body, `backend ${path}`);
  scanForSecrets(headersCombined, `backend ${path} response headers`);
  for (const forbidHost of forbidHosts) {
    logResult(!containsForbiddenHost(`${body}\n${headersCombined}`, [forbidHost]), `backend ${path} does not leak forbidden host "${forbidHost}"`);
  }

  // Explicit redirect handling: fail clearly rather than silently follow.
  if (REDIRECT_STATUSES.has(status)) {
    logResult(false, `backend ${path} did not redirect`, `got ${status}${location ? ` location=${location}` : " (no location header)"}`);
    return;
  }

  // 5/6. Only attempt structured JSON checks once the body is confirmed
  // parseable — a null, empty, or malformed body must fail cleanly, not throw.
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    logResult(false, `backend ${path} returns valid JSON`, `got non-JSON body (status ${status})`);
    return;
  }

  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    logResult(false, `backend ${path} returns a JSON object`, `got ${Array.isArray(json) ? "an array" : typeof json}`);
    return;
  }

  describe(status, json);
}

async function checkBackend() {
  if (!backendBaseUrl) return;

  console.log(`\nBackend checks against: ${backendBaseUrl}`);

  if (requireBackendHost) {
    const hostname = normalizedHostname(backendBaseUrl) ?? "";
    logResult(
      hostname.includes(requireBackendHost.toLowerCase()),
      `BACKEND_URL host matches required substring "${requireBackendHost}"`,
      `got hostname ${hostname || "(unparseable)"}`
    );
  }

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
