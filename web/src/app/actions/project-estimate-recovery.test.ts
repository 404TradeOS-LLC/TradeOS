import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as createIntents from "../../lib/universal-create.ts";

const compiled = ts.transpileModule(readFileSync(new URL("./projects.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

class Redirect extends Error {
  destination: string;
  constructor(destination: string) { super(destination); this.destination = destination; }
}

function actionWithTransport(transport: (path: string) => Promise<unknown>) {
  const requests: Array<{ path: string; body: unknown; token: string }> = [];
  const exports: Record<string, unknown> = {};
  vm.runInNewContext(compiled, {
    exports,
    require(specifier: string) {
      if (specifier === "next/navigation") return { redirect: (destination: string) => { throw new Redirect(destination); } };
      if (specifier === "next/cache") return { revalidatePath: () => undefined };
      if (specifier === "@/lib/session") return { getSessionToken: async () => "session-fixture" };
      if (specifier === "@/lib/universal-create") return createIntents;
      if (specifier === "@/lib/api") return {
        ApiClientError: class extends Error {},
        apiFetch: async (path: string, options: { body: string; token: string }) => {
          requests.push({ path, body: JSON.parse(options.body), token: options.token });
          return transport(path);
        },
      };
      if (["@/lib/supabase/server", "@/lib/storage", "@/lib/projectFileStorage", "@/lib/projectFileStorageWorkflow"].includes(specifier)) return {};
      throw new Error(`Unexpected import: ${specifier}`);
    },
  });
  const action = exports.createProjectAction as (previous: undefined, form: FormData) => Promise<unknown>;
  const form = new FormData();
  form.set("name", "Kitchen");
  form.set("simpleScope", "Paint the cabinets");
  form.set("intent", "estimate");
  return { requests, submit: () => action(undefined, form) };
}

for (const outcome of ["rejected", "response-lost-after-commit"]) {
  test(`${outcome}: a confirmed Project survives an unconfirmed Estimate without automatic retry`, async () => {
    let savedEstimate = false;
    const { requests, submit } = actionWithTransport(async path => {
      if (path === "/api/v1/projects") return { id: projectId };
      savedEstimate = outcome === "response-lost-after-commit";
      throw new Error("Estimate response unavailable");
    });
    await assert.rejects(submit(), error => error instanceof Redirect && error.destination === `/projects/${projectId}?estimateStart=review`);
    assert.deepEqual(requests.map(request => request.path), ["/api/v1/projects", "/api/v1/estimates"]);
    assert.deepEqual(requests[0].body, { name: "Kitchen", simpleScope: "Paint the cabinets" });
    assert.deepEqual(requests[1].body, { projectId });
    assert.ok(requests.every(request => request.token === "session-fixture"));
    assert.equal(savedEstimate, outcome === "response-lost-after-commit");
  });
}

test("confirmed Estimate success opens that Estimate rather than the recovery destination", async () => {
  const { submit } = actionWithTransport(async path => path === "/api/v1/projects" ? { id: projectId } : { id: "estimate-fixture" });
  await assert.rejects(submit(), error => error instanceof Redirect && error.destination === `/projects/${projectId}/estimates/estimate-fixture`);
});

test("Project save failure does not attempt to create an Estimate", async () => {
  const { requests, submit } = actionWithTransport(async () => { throw new Error("Project unavailable"); });
  const result = await submit() as { error: string };
  assert.equal(result.error, "Something went wrong.");
  assert.deepEqual(requests.map(request => request.path), ["/api/v1/projects"]);
});
