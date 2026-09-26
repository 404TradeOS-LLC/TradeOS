import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answerForClarificationChoice,
  appendClarification,
  buildDraftRequestBody,
  getActiveClarification,
  submitClarification,
} from "./clarification.ts";

test("an item count is appended beside its own object for estimator parsing", () => {
  const scope = appendClarification("Paint 12 cabinet doors and drawers", "How many Drawers are included?", "6");
  assert.equal(scope, "Paint 12 cabinet doors and drawers\n6 Drawers");
});

test("other scope-changing answers reach regeneration intact", () => {
  assert.equal(appendClarification("Coat garage floor", "What is the finish?", "Tan epoxy"), "Coat garage floor\nWhat is the finish?: Tan epoxy");
});

test("clarification proceeds one server question at a time and carries each answer into the next draft request", () => {
  const initialScope = "Paint 12 cabinet doors and drawers";
  const firstQuestions = ["How many Drawers are included?", "What finish should be used?"];
  const firstQuestion = getActiveClarification(firstQuestions);

  assert.deepEqual(getActiveClarification(firstQuestions), firstQuestions[0]);

  const firstScope = submitClarification(initialScope, firstQuestion, answerForClarificationChoice("6"));
  assert.equal(firstScope, "Paint 12 cabinet doors and drawers\n6 Drawers");
  assert.deepEqual(buildDraftRequestBody(firstScope ?? ""), { scopeOfWork: "Paint 12 cabinet doors and drawers\n6 Drawers" });

  const secondQuestion = getActiveClarification(firstQuestions.slice(1));
  assert.equal(secondQuestion, "What finish should be used?");
  assert.equal(answerForClarificationChoice("Other"), "");

  const secondScope = submitClarification(firstScope ?? "", secondQuestion, "Satin white");
  assert.equal(secondScope, "Paint 12 cabinet doors and drawers\n6 Drawers\nWhat finish should be used?: Satin white");
  assert.deepEqual(buildDraftRequestBody(secondScope ?? ""), { scopeOfWork: secondScope });

  assert.equal(getActiveClarification([]), null);
});

test("blank answers and the Other choice cannot advance clarification", () => {
  const question = "What finish should be used?";
  assert.equal(submitClarification("Paint cabinets", question, "  "), null);
  assert.equal(submitClarification("Paint cabinets", question, "Other"), null);
  assert.equal(submitClarification("Paint cabinets", null, "Satin"), null);
});
