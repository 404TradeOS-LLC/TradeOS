import assert from "node:assert/strict";
import test from "node:test";
import { ClientApiError } from "./clientApi.ts";
import {
  getEstimateScopeClarification,
  saveEstimateScopeClarification,
  type EstimateScopeClarification,
} from "./estimate-scope-clarification.ts";

const question = { questionKey: "existing-deck-footing-site-check.v1", question: "Have the footings been checked?", revision: 0, answer: null };

test("retry uses the same question, note and revision after an offline save", async (t) => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const answer = { kind: "details", detail: "24 in × 12 in, sound concrete" } as const;
  const saved: EstimateScopeClarification = { ...question, revision: 1, answer };
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    if (requests.length === 1) throw new TypeError("offline");
    return Response.json({ clarification: saved });
  });

  await assert.rejects(saveEstimateScopeClarification("estimate-1", question, answer), /offline/);
  assert.deepEqual(await saveEstimateScopeClarification("estimate-1", question, answer), saved);
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(requests[1].url, "/api/proxy/estimates/estimate-1/ai-estimator/clarification");
  assert.deepEqual(JSON.parse(requests[1].init?.body as string), { questionKey: question.questionKey, expectedRevision: 0, answer });
  assert.deepEqual(await getEstimateScopeClarification("estimate-1"), saved);
  assert.equal(requests[2].init?.cache, "no-store");
});

test("surfaces a stale answer conflict for explicit recovery", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "A newer answer was saved." }, { status: 409 }));
  await assert.rejects(
    saveEstimateScopeClarification("estimate-1", question, { kind: "site_check_assumption" }),
    (error) => error instanceof ClientApiError && error.status === 409,
  );
});
