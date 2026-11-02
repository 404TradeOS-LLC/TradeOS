import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as receipts from "../../../../../lib/job-expense-receipts.ts";

const ORG = "11111111-1111-4111-8111-111111111111";
const JOB = "22222222-2222-4222-8222-222222222222";
const EXPENSE = "33333333-3333-4333-8333-333333333333";
const OBJECT = "44444444-4444-4444-8444-444444444444";
const path = receipts.buildExpenseReceiptPath(ORG, JOB, EXPENSE, "application/pdf", OBJECT);

async function loadRoute(input: { token: string | null; expense?: Record<string, unknown>; deny?: boolean }) {
  const source = await readFile(new URL("./route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const calls: string[] = [];
  const exports: Record<string, unknown> = {};
  const fakeExpense = {
    id: EXPENSE, jobId: JOB, orgId: ORG,
    receiptStoragePath: path, receiptContentType: "application/pdf",
    receiptFileName: "receipt.pdf", receiptSizeBytes: 6,
    ...(input.expense ?? {}),
  };
  class FakeApiClientError extends Error {
    constructor(message: string, public status: number) { super(message); }
  }
  vm.runInNewContext(compiled, {
    exports, Response, Request, Blob, encodeURIComponent,
    require(specifier: string) {
      if (specifier === "@/lib/job-expense-receipts") return receipts;
      if (specifier === "@/lib/session") return { getSessionToken: async () => input.token };
      if (specifier === "@/lib/api") return {
        ApiClientError: FakeApiClientError,
        apiFetch: async (url: string) => {
          calls.push("api:" + url);
          if (input.deny) {
            throw new FakeApiClientError("Not found", 404);
          }
          return fakeExpense;
        },
      };
      if (specifier === "@/lib/supabase/admin") return {
        createSupabaseAdminClient: () => {
          calls.push("storage-admin");
          return { storage: { from: (bucket: string) => {
            calls.push("bucket:" + bucket);
            return { download: async (key: string) => {
              calls.push("download:" + key);
              return { data: new Blob([new Uint8Array([37, 80, 68, 70, 45, 49])]), error: null };
            } };
          } } };
        },
      };
      throw new Error("Unexpected receipt route dependency: " + specifier);
    },
  });
  const GET = exports.GET as (request: Request, context: { params: Promise<{ jobId: string; expenseId: string }> }) => Promise<Response>;
  return {
    calls,
    get: () => GET(new Request("https://tradeos.example/receipt"), {
      params: Promise.resolve({ jobId: JOB, expenseId: EXPENSE }),
    }),
  };
}

test("private receipt request with no session never reads API or Storage", async () => {
  const route = await loadRoute({ token: null });
  const result = await route.get();
  assert.equal(result.status, 401);
  assert.deepEqual(route.calls, []);
});

test("a denied job or cross-tenant API read never reaches privileged Storage", async () => {
  const route = await loadRoute({ token: "auth", deny: true });
  const result = await route.get();
  assert.equal(result.status, 404);
  assert.equal(route.calls.includes("storage-admin"), false);
});

test("receipt path must match authenticated expense namespace", async () => {
  const route = await loadRoute({ token: "auth", expense: { receiptStoragePath: path.replace(ORG, OBJECT) } });
  const result = await route.get();
  assert.equal(result.status, 404);
  assert.equal(route.calls.includes("storage-admin"), false);
});

test("valid authorized receipt is private and downloaded from the exact path", async () => {
  const route = await loadRoute({ token: "auth" });
  const result = await route.get();
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("Cache-Control"), "private, no-store");
  assert.equal(result.headers.get("Content-Type"), "application/octet-stream");
  assert.ok(route.calls.includes("download:" + path));
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array([37, 80, 68, 70, 45, 49]));
});
