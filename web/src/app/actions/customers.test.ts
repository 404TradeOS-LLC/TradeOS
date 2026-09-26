import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

type Customer = { id: string; name: string; email: string | null; phone: string | null };
type Mocks = { token: string | null; lookup: (query: string) => Promise<Customer[]>; posts: unknown[] };
const mocks: Mocks = { token: "staff-session", lookup: async () => [], posts: [] };
(globalThis as typeof globalThis & { customerActionMocks: Mocks }).customerActionMocks = mocks;
const dataModule = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;

// Execute the real action while replacing only its external API and framework seams.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/api") return { url: dataModule(`
      export class ApiClientError extends Error {}
      export async function listCustomers(_token, {query}) { return globalThis.customerActionMocks.lookup(query); }
      export async function apiFetch(path, options) { globalThis.customerActionMocks.posts.push({path, options}); }
    `), shortCircuit: true };
    if (specifier === "@/lib/session") return { url: dataModule("export async function getSessionToken() { return globalThis.customerActionMocks.token; }"), shortCircuit: true };
    if (specifier === "@/lib/service-address-form") return { url: dataModule("export function parseServiceAddressForm() { return {}; }"), shortCircuit: true };
    if (specifier === "@/lib/customer-duplicate-matches") return { url: new URL("../../lib/customer-duplicate-matches.ts", import.meta.url).href, shortCircuit: true };
    if (specifier === "next/navigation") return { url: dataModule("export function redirect() { throw new Error('redirected'); }"), shortCircuit: true };
    if (specifier === "next/cache") return { url: dataModule("export function revalidatePath() {}"), shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const { createCustomerAction } = await import("./customers.ts");
function form(intent = "create") {
  const data = new FormData();
  data.set("name", "Smith Family");
  data.set("email", "smith@example.com");
  data.set("intent", intent);
  return data;
}

test("missing session stops lookup and creation", async () => {
  mocks.token = null;
  mocks.lookup = async () => { throw new Error("lookup must not run"); };
  mocks.posts = [];
  const result = await createCustomerAction(undefined, form());
  assert.match(result?.error ?? "", /Sign in again/);
  assert.equal(mocks.posts.length, 0);
  mocks.token = "staff-session";
});

test("failed or truncated lookup blocks customer creation even with separate intent", async () => {
  mocks.posts = [];
  mocks.lookup = async () => { throw new Error("unavailable"); };
  assert.equal((await createCustomerAction(undefined, form("create-separate")))?.customerMatchLookupFailed, true);
  assert.equal(mocks.posts.length, 0);
  mocks.lookup = async () => Array.from({ length: 250 }, (_, index) => ({
    id: String(index), name: `Smith Family ${index}`, email: null, phone: null,
  }));
  assert.equal((await createCustomerAction(undefined, form("create-separate")))?.customerMatchLookupFailed, true);
  assert.equal(mocks.posts.length, 0);
});

test("matches require explicit separate-record intent before POST", async () => {
  mocks.posts = [];
  mocks.lookup = async () => [{ id: "existing", name: "Smith Family", email: "smith@example.com", phone: null }];
  const result = await createCustomerAction(undefined, form());
  assert.deepEqual(result?.customerMatches?.[0]?.matchedOn, ["name", "email"]);
  assert.equal(mocks.posts.length, 0);
  await assert.rejects(createCustomerAction(undefined, form("create-separate")), /redirected/);
  assert.equal(mocks.posts.length, 1);
  assert.equal((mocks.posts[0] as { path: string }).path, "/api/v1/customers");
});
