import assert from "node:assert/strict";
import { test } from "node:test";
import { appendClarification } from "./clarification.ts";

test("an item count is appended beside its own object for estimator parsing", () => {
  const scope = appendClarification("Paint 12 cabinet doors and drawers", "How many Drawers are included?", "6");
  assert.equal(scope, "Paint 12 cabinet doors and drawers\n6 Drawers");
});

test("other scope-changing answers reach regeneration intact", () => {
  assert.equal(appendClarification("Coat garage floor", "What is the finish?", "Tan epoxy"), "Coat garage floor\nWhat is the finish?: Tan epoxy");
});
