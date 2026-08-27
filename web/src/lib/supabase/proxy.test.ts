import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, it } from "node:test";
import ts from "typescript";

const dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(dirname, "../../..");

function createCookieStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  const options = new Map();
  const deleted = new Set();

  return {
    get(name) {
      const value = values.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll() {
      return [...values].map(([name, value]) => ({ name, value }));
    },
    set(name, value, cookieOptions) {
      values.set(name, value);
      options.set(name, cookieOptions);
      deleted.delete(name);
    },
    delete(name) {
      values.delete(name);
      options.delete(name);
      deleted.add(name);
    },
    value(name) {
      return values.get(name);
    },
    wasDeleted(name) {
      return deleted.has(name);
    },
  };
}

function createRequest(cookies) {
  return {
    cookies: createCookieStore(cookies),
    nextUrl: {
      clone() {
        return new URL("https://app.404tradeos.com/dashboard");
      },
    },
  };
}

function loadProxyModule(fetchImpl) {
  const proxySource = readFileSync(resolve(dirname, "proxy.ts"), "utf8");
  const transpiled = ts.transpileModule(proxySource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  class FakeNextResponse {
    static next({ request }) {
      return { kind: "next", request, cookies: createCookieStore() };
    }

    static redirect(url) {
      return { kind: "redirect", url, cookies: createCookieStore() };
    }
  }

  const runtimeModule = { exports: {} };
  const context = vm.createContext({
    module: runtimeModule,
    exports: runtimeModule.exports,
    console,
    URL,
    fetch: fetchImpl,
    process: {
      env: {
        BACKEND_API_URL: "http://backend.test",
        NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
        NODE_ENV: "test",
      },
    },
    require(specifier) {
      if (specifier === "next/server") {
        return { NextResponse: FakeNextResponse };
      }
      if (specifier === "@supabase/ssr") {
        return {
          createServerClient() {
            return {
              auth: {
                async getClaims() {
                  return { data: { claims: {} } };
                },
              },
            };
          },
        };
      }
      if (specifier === "@/lib/local-auth") {
        return {
          LOCAL_ACCESS_TOKEN_COOKIE: "tradeos_access_token",
          LOCAL_REFRESH_TOKEN_COOKIE: "tradeos_refresh_token",
          isUsableLocalAccessToken() {
            return false;
          },
          decodeLocalAccessToken(token) {
            if (token !== "fresh-access-token") return null;
            return {
              sub: "user-1",
              exp: Math.floor(Date.now() / 1000) + 3600,
            };
          },
        };
      }
      throw new Error(`Unexpected module request: ${specifier}`);
    },
  });

  new vm.Script(transpiled, { filename: "proxy.test-runtime.js" }).runInContext(context);
  return runtimeModule.exports;
}

describe("web auth proxy", () => {
  it("redirects unauthenticated requests before app routes render", () => {
    const proxySource = readFileSync(resolve(dirname, "proxy.ts"), "utf8");

    assert.match(proxySource, /const \{ data \} = await supabase\.auth\.getClaims\(\)/);
    assert.match(proxySource, /if \(!data\?\.claims\.sub\)/);
    assert.match(proxySource, /NextResponse\.redirect\(loginUrl\)/);
  });

  it("refreshes a local session when only the refresh cookie remains", async () => {
    const refreshCalls = [];
    const { updateSession } = loadProxyModule(async (url, init) => {
      refreshCalls.push({ url, init });
      return {
        ok: true,
        async json() {
          return {
            token: "fresh-access-token",
            refreshToken: "fresh-refresh-token",
          };
        },
      };
    });

    const request = createRequest({ tradeos_refresh_token: "refresh-only-token" });
    const response = await updateSession(request);

    assert.equal(refreshCalls.length, 1);
    assert.equal(refreshCalls[0].url, "http://backend.test/api/v1/auth/refresh");
    assert.equal(refreshCalls[0].init.method, "POST");
    assert.deepEqual(JSON.parse(refreshCalls[0].init.body), {
      refreshToken: "refresh-only-token",
    });
    assert.equal(response.kind, "next");
    assert.equal(response.cookies.value("tradeos_access_token"), "fresh-access-token");
    assert.equal(response.cookies.value("tradeos_refresh_token"), "fresh-refresh-token");
  });

  it("fails closed without deleting replacement cookies when a refresh-only request loses a rotation race", async () => {
    const { updateSession } = loadProxyModule(async () => ({
      ok: false,
      async json() {
        return {};
      },
    }));

    const request = createRequest({ tradeos_refresh_token: "single-use-token" });
    const response = await updateSession(request);

    assert.equal(response.kind, "redirect");
    assert.equal(response.url.pathname, "/login");
    assert.equal(response.cookies.wasDeleted("tradeos_access_token"), false);
    assert.equal(response.cookies.wasDeleted("tradeos_refresh_token"), false);
  });

  it("runs on every protected app route family", () => {
    const proxySource = readFileSync(resolve(root, "src/proxy.ts"), "utf8");

    for (const route of [
      "/athena/:path*",
      "/brand-studio/:path*",
      "/costbook/:path*",
      "/customers/:path*",
      "/dashboard/:path*",
      "/dispatch/:path*",
      "/finish-setup/:path*",
      "/field/:path*",
      "/portal/:path*",
      "/projects/:path*",
      "/settings/:path*",
    ]) {
      assert.ok(proxySource.includes(route));
    }
  });
});