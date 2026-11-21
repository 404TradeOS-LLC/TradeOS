// Resolve the Playwright agent-browser proxy from the process environment.
//
// The sandbox egress proxy address (and any credential it carries) is never
// hardcoded and never logged: it is read at runtime from the standard
// HTTP_PROXY / HTTPS_PROXY / ALL_PROXY variables (either case) and passed
// straight through to Playwright. When no proxy variable is set, this
// returns undefined and the browser falls back to its own defaults (system
// proxy settings), which is how the sandbox egress is reached today.
// NO_PROXY is passed through as the Playwright bypass list, with a bare
// `*` translated so Firefox's suffix-matching bypass honors it (see below).
//
// Callers must treat the returned value as secret material: pass it to
// Playwright, never print it. Error messages name the variable, never the
// value.
//
// Credentials are split into Playwright's `username` / `password` fields:
// Playwright's own normalization rebuilds `server` from protocol + host and
// discards any userinfo embedded in the URL, so a `user:pass@host` server
// alone would silently lose proxy authentication.

const PROXY_VARIABLES = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "ALL_PROXY",
  "all_proxy",
];

const BYPASS_VARIABLES = ["NO_PROXY", "no_proxy"];

function firstSet(env, names) {
  for (const name of names) {
    const value = env?.[name];
    if (typeof value === "string" && value.trim() !== "") {
      return { name, value: value.trim() };
    }
  }
  return undefined;
}

/**
 * Resolve a Playwright `proxy` option (`{ server, bypass? }`) from `env`.
 * Returns `undefined` when no proxy variable is set. Throws when a set
 * variable is not a usable `http:`/`https:` proxy URL; the message names the
 * variable, never the value.
 */
export function resolveMcpProxy(env = {}) {
  const found = firstSet(env, PROXY_VARIABLES);
  if (!found) return undefined;

  let parsed;
  try {
    parsed = new URL(found.value);
  } catch {
    throw new Error(
      `TradeOS MCP proxy: ${found.name} is not a valid proxy URL (expected http:// or https:// host)`,
    );
  }
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error(
      `TradeOS MCP proxy: ${found.name} is not a valid proxy URL (expected http:// or https:// host)`,
    );
  }

  const bypass = firstSet(env, BYPASS_VARIABLES);
  // Strip credentials out of `server`: Playwright keeps `username` /
  // `password` fields but rebuilds `server` from protocol + host.
  const proxy = { server: `${parsed.protocol}//${parsed.host}` };
  if (parsed.username) {
    proxy.username = decodeURIComponent(parsed.username);
    proxy.password = decodeURIComponent(parsed.password);
  }
  if (bypass) {
    // A bare `*` in NO_PROXY means "bypass the proxy for every host",
    // but the Firefox (Juggler) bypass check is host-suffix matching, so
    // a `*` entry never matches and the host is still proxied (verified
    // live: Playwright 1.65.0 / Firefox 157 routes `bypass: '*'` through
    // the proxy, while a list containing an empty entry routes directly
    // because every hostname ends with ''). Keep the proxy object and the
    // original entries — omitting `proxy` would let Firefox fall back to
    // the system (environment) proxy — and append the empty entry so the
    // `*` intent survives the trip to Firefox.
    const entries = bypass.value.split(",").map((entry) => entry.trim());
    proxy.bypass = entries.includes("*")
      ? `${entries.join(",")},`
      : bypass.value;
  }
  return proxy;
}
