import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { verifyRecoveryIdentity } from "./recovery-core.ts";

const routeUrl = new URL("./route.ts", import.meta.url);
const dirname = fileURLToPath(new URL(".", import.meta.url));

async function readRecoveryRouteSource(): Promise<string> {
  return readFile(routeUrl, "utf8");
}

type RecoveryAuthOverrides = {
  exchangeCodeForSession?: (code: string) => Promise<{ error: { message: string } | null }>;
  verifyOtp?: (input: { token_hash: string; type: "recovery" }) => Promise<{ error: { message: string } | null }>;
  getUser: () => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
};

function createCookieStore() {
  const store = new Map<string, { value: string; options?: Record<string, unknown> }>();
  return {
    set(name: string, value: string, options?: Record<string, unknown>) {
      store.set(name, { value, options });
    },
    get(name: string) {
      return store.get(name);
    },
    getAll() {
      return [...store.entries()].map(([name, entry]) => ({ name, value: entry.value }));
    },
  };
}

function createFakeRequest(url: string) {
  return { url, cookies: createCookieStore() };
}

/**
 * Loads the real route.ts GET handler in an isolated VM, stubbing only its
 * "@supabase/ssr" and "next/server" module boundaries (mirroring the pattern
 * in web/src/lib/supabase/proxy.test.ts), so the handler's own redirect and
 * cookie-writing logic executes for real against a fake Supabase auth client.
 */
function loadRecoveryRoute(authOverrides: RecoveryAuthOverrides) {
  const source = readFileSync(resolve(dirname, "route.ts"), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  class FakeNextResponse {
    static redirect(url: URL) {
      return { kind: "redirect", url, cookies: createCookieStore() };
    }
  }

  const runtimeModule = { exports: {} as { GET?: (request: unknown) => Promise<unknown> } };
  const context = vm.createContext({
    module: runtimeModule,
    exports: runtimeModule.exports,
    console,
    URL,
    process: {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
        NODE_ENV: "test",
      },
    },
    require(specifier: string) {
      if (specifier === "next/server") {
        return { NextResponse: FakeNextResponse };
      }
      if (specifier === "@supabase/ssr") {
        return {
          createServerClient() {
            return {
              auth: {
                async exchangeCodeForSession(code: string) {
                  if (!authOverrides.exchangeCodeForSession) {
                    throw new Error("exchangeCodeForSession should not be called for this flow");
                  }
                  return authOverrides.exchangeCodeForSession(code);
                },
                async verifyOtp(input: { token_hash: string; type: "recovery" }) {
                  if (!authOverrides.verifyOtp) {
                    throw new Error("verifyOtp should not be called for this flow");
                  }
                  return authOverrides.verifyOtp(input);
                },
                getUser: authOverrides.getUser,
              },
            };
          },
        };
      }
      if (specifier === "./recovery-core") {
        return { verifyRecoveryIdentity };
      }
      throw new Error(`Unexpected module request: ${specifier}`);
    },
  });

  new vm.Script(transpiled, { filename: "route.test-runtime.js" }).runInContext(context);
  return runtimeModule.exports as { GET: (request: unknown) => Promise<{ kind: string; url: URL; cookies: ReturnType<typeof createCookieStore> }> };
}

function createRecoveryClient(options: { userId?: string; calls: string[] }) {
  return {
    auth: {
      async exchangeCodeForSession(code: string) {
        options.calls.push(`exchange:${code}`);
        return { error: null };
      },
      async verifyOtp(input: { token_hash: string; type: "recovery" }) {
        options.calls.push(`verify:${input.token_hash}:${input.type}`);
        return { error: null };
      },
      async getUser() {
        options.calls.push("getUser");
        return {
          data: { user: options.userId ? { id: options.userId } : null },
          error: null,
        };
      },
    },
  };
}

test("PKCE recovery verifies the session before returning the recovered user id", async () => {
  const calls: string[] = [];
  const result = await verifyRecoveryIdentity(
    createRecoveryClient({ userId: "11111111-1111-4111-8111-111111111111", calls }),
    { code: "pkce-code", tokenHash: null, type: null },
  );

  assert.deepEqual(calls, ["exchange:pkce-code", "getUser"]);
  assert.deepEqual(result, { ok: true, userId: "11111111-1111-4111-8111-111111111111" });
});

test("token-hash recovery verifies the OTP before returning the recovered user id", async () => {
  const calls: string[] = [];
  const result = await verifyRecoveryIdentity(
    createRecoveryClient({ userId: "22222222-2222-4222-8222-222222222222", calls }),
    { code: null, tokenHash: "recovery-hash", type: "recovery" },
  );

  assert.deepEqual(calls, ["verify:recovery-hash:recovery", "getUser"]);
  assert.deepEqual(result, { ok: true, userId: "22222222-2222-4222-8222-222222222222" });
});

test("recovery verification fails closed when the exchanged session has no verified user", async () => {
  const calls: string[] = [];
  const result = await verifyRecoveryIdentity(createRecoveryClient({ calls }), {
    code: "pkce-code",
    tokenHash: null,
    type: null,
  });

  assert.deepEqual(calls, ["exchange:pkce-code", "getUser"]);
  assert.deepEqual(result, { ok: false, stage: "identity", message: undefined });
});

test("recovery route writes only the verified identity into the HttpOnly marker", async () => {
  const source = await readRecoveryRouteSource();

  assert.match(source, /verifyRecoveryIdentity\(supabase, \{ code, tokenHash, type \}\)/);
  assert.match(source, /response\.cookies\.set\("tradeos-recovery", verification\.userId,/);
  assert.match(source, /httpOnly:\s*true/);
  assert.doesNotMatch(source, /cookies\.set\(\s*["']tradeos-recovery["']\s*,\s*["']1["']/);
  assert.match(source, /request\.cookies\.set\(name, value\)/);
  assert.match(source, /response\.cookies\.set\(name, value, options\)/);
});

test("GET sets the recovery marker to the verified user id after a PKCE exchange", async () => {
  const { GET } = loadRecoveryRoute({
    async exchangeCodeForSession(code) {
      assert.equal(code, "pkce-code");
      return { error: null };
    },
    async getUser() {
      return { data: { user: { id: "11111111-1111-4111-8111-111111111111" } }, error: null };
    },
  });

  const response = await GET(createFakeRequest("https://app.test/auth/confirm?code=pkce-code"));

  assert.equal(response.kind, "redirect");
  assert.equal(response.url.pathname, "/reset-password");
  assert.equal(response.url.searchParams.get("error"), null);
  const marker = response.cookies.get("tradeos-recovery");
  assert.equal(marker?.value, "11111111-1111-4111-8111-111111111111");
  assert.equal(marker?.options?.httpOnly, true);
});

test("GET sets the recovery marker to the verified user id after a token-hash exchange", async () => {
  const { GET } = loadRecoveryRoute({
    async verifyOtp(input) {
      assert.deepEqual(input, { token_hash: "recovery-hash", type: "recovery" });
      return { error: null };
    },
    async getUser() {
      return { data: { user: { id: "22222222-2222-4222-8222-222222222222" } }, error: null };
    },
  });

  const response = await GET(
    createFakeRequest("https://app.test/auth/confirm?token_hash=recovery-hash&type=recovery"),
  );

  assert.equal(response.kind, "redirect");
  assert.equal(response.url.pathname, "/reset-password");
  const marker = response.cookies.get("tradeos-recovery");
  assert.equal(marker?.value, "22222222-2222-4222-8222-222222222222");
});

test("GET fails closed to invalid-link without setting a recovery marker when no user is returned", async () => {
  const { GET } = loadRecoveryRoute({
    async exchangeCodeForSession() {
      return { error: null };
    },
    async getUser() {
      return { data: { user: null }, error: null };
    },
  });

  const response = await GET(createFakeRequest("https://app.test/auth/confirm?code=pkce-code"));

  assert.equal(response.kind, "redirect");
  assert.equal(response.url.pathname, "/reset-password");
  assert.equal(response.url.searchParams.get("error"), "invalid-link");
  assert.equal(response.cookies.get("tradeos-recovery"), undefined);
});
