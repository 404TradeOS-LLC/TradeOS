import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMcpProxy } from "./proxy-env.mjs";

test("no proxy variables set returns undefined (browser falls back to defaults)", () => {
  assert.equal(resolveMcpProxy({}), undefined);
  assert.equal(resolveMcpProxy({ NO_PROXY: "localhost" }), undefined);
  assert.equal(resolveMcpProxy({ HTTPS_PROXY: "   " }), undefined);
});

test("prefers HTTPS_PROXY over HTTP_PROXY and ALL_PROXY", () => {
  assert.deepEqual(
    resolveMcpProxy({
      HTTPS_PROXY: "http://proxy.example:3128",
      HTTP_PROXY: "http://other.example:3128",
      ALL_PROXY: "http://third.example:3128",
    }),
    { server: "http://proxy.example:3128" },
  );
});

test("falls back to HTTP_PROXY, then ALL_PROXY, then lowercase variants", () => {
  assert.deepEqual(resolveMcpProxy({ HTTP_PROXY: "http://proxy.example:3128" }), {
    server: "http://proxy.example:3128",
  });
  assert.deepEqual(resolveMcpProxy({ ALL_PROXY: "http://proxy.example:3128" }), {
    server: "http://proxy.example:3128",
  });
  assert.deepEqual(resolveMcpProxy({ https_proxy: "http://proxy.example:3128" }), {
    server: "http://proxy.example:3128",
  });
  assert.deepEqual(resolveMcpProxy({ http_proxy: "http://proxy.example:3128" }), {
    server: "http://proxy.example:3128",
  });
});

test("passes NO_PROXY through as the Playwright bypass list", () => {
  assert.deepEqual(
    resolveMcpProxy({
      HTTPS_PROXY: "http://proxy.example:3128",
      NO_PROXY: "localhost,127.0.0.1,.internal.example",
    }),
    {
      server: "http://proxy.example:3128",
      bypass: "localhost,127.0.0.1,.internal.example",
    },
  );
  assert.deepEqual(
    resolveMcpProxy({
      HTTPS_PROXY: "http://proxy.example:3128",
      no_proxy: "localhost",
    }),
    { server: "http://proxy.example:3128", bypass: "localhost" },
  );
});

test("translates a bare NO_PROXY=* into a bypass list Firefox honors for every host", () => {
  // Playwright's Firefox (Juggler) bypass check is host-suffix matching,
  // so `*` never matches and the host would still be proxied. A list
  // containing an empty entry matches every hostname. The proxy object
  // itself is kept: omitting it would let Firefox fall back to the
  // system (environment) proxy. Verified live against Playwright 1.65.0 /
  // Firefox 157 with a dead proxy: `bypass: '*'` fails the navigation,
  // `bypass: '*,'` loads directly.
  assert.deepEqual(
    resolveMcpProxy({
      HTTPS_PROXY: "http://proxy.example:3128",
      NO_PROXY: "*",
    }),
    { server: "http://proxy.example:3128", bypass: "*," },
  );
  assert.deepEqual(
    resolveMcpProxy({
      HTTPS_PROXY: "http://proxy.example:3128",
      NO_PROXY: "*,localhost",
    }),
    { server: "http://proxy.example:3128", bypass: "*,localhost," },
  );
});

test("splits credentials into username/password and keeps them out of server", () => {
  assert.deepEqual(
    resolveMcpProxy({ HTTPS_PROXY: "http://user:pass@proxy.example:3128" }),
    { server: "http://proxy.example:3128", username: "user", password: "pass" },
  );
  // Percent-encoded credentials are URL-decoded, matching Playwright's own
  // handling of proxy URLs.
  assert.deepEqual(
    resolveMcpProxy({ HTTPS_PROXY: "http://user:p%40ss%3Aword@proxy.example:3128" }),
    { server: "http://proxy.example:3128", username: "user", password: "p@ss:word" },
  );
});

test("rejects a malformed proxy URL and never echoes the value", () => {
  for (const variable of ["HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY"]) {
    assert.throws(
      () => resolveMcpProxy({ [variable]: "not a url ::" }),
      (error) => {
        assert.match(error.message, new RegExp(`^TradeOS MCP proxy: ${variable} is not a valid proxy URL`));
        assert.doesNotMatch(error.message, /not a url/);
        return true;
      },
    );
    assert.throws(
      () => resolveMcpProxy({ [variable]: "ftp://proxy.example:21" }),
      (error) => {
        assert.match(error.message, new RegExp(`^TradeOS MCP proxy: ${variable} is not a valid proxy URL`));
        assert.doesNotMatch(error.message, /ftp:\/\//);
        return true;
      },
    );
  }
});
