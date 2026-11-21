// Resolve the Playwright agent-browser proxy from the process environment.
//
// The sandbox egress proxy address (and any credential it carries) is never
// hardcoded and never logged: it is read at runtime from the standard
// HTTP_PROXY / HTTPS_PROXY / ALL_PROXY variables (either case) and passed
// straight through to Playwright. When no proxy variable is set, this
// returns undefined and the browser falls back to its own defaults (system
// proxy settings), which is how the sandbox egress is reached today.
//
// Callers must treat the returned `server` value as secret material: pass it
// to Playwright, never print it. Error messages name the variable, never the
// value.

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
  const proxy = { server: found.value };
  if (bypass) proxy.bypass = bypass.value;
  return proxy;
}
