import assert from "node:assert/strict";
import test from "node:test";
import {
  ATHENA_ESTIMATE_DRAFT_KEY,
  makeAthenaEstimateDraft,
  readAthenaEstimateDraft,
} from "./athena-estimate-handoff.ts";

const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);

test("Athena estimate handoff contains only trimmed contractor-provided notes, in order", () => {
  const raw = makeAthenaEstimateDraft(["  Build a deck. ", "", " 12 by 16 feet. "], NOW);
  assert.ok(raw);
  assert.equal(ATHENA_ESTIMATE_DRAFT_KEY, "tradeos:athena-estimate-draft:v1");
  assert.equal(readAthenaEstimateDraft(raw, NOW + 1000), "Build a deck.\n\n12 by 16 feet.");
});

test("an empty or oversized draft is refused before browser storage", () => {
  assert.equal(makeAthenaEstimateDraft([" ", "\n"], NOW), null);
  assert.equal(makeAthenaEstimateDraft(["x".repeat(4001)], NOW), null);
});

test("expired, future-dated, and malformed data never autofill the form", () => {
  const raw = makeAthenaEstimateDraft(["Replace two doors"], NOW);
  assert.ok(raw);
  assert.equal(readAthenaEstimateDraft(raw, NOW + 5 * 60_000 + 1), null);
  assert.equal(readAthenaEstimateDraft(raw, NOW - 1), null);
  assert.equal(readAthenaEstimateDraft("not-json", NOW), null);
  assert.equal(readAthenaEstimateDraft(null, NOW), null);
});

test("unexpected versions and forged payloads cannot autofill scope", () => {
  assert.equal(readAthenaEstimateDraft(JSON.stringify({ version: 2, createdAt: NOW, scope: "bad" }), NOW), null);
  assert.equal(readAthenaEstimateDraft(JSON.stringify({ version: 1, createdAt: NOW, scope: "z".repeat(4001) }), NOW), null);
  assert.equal(readAthenaEstimateDraft(JSON.stringify({ version: 1, createdAt: NOW, scope: { unexpected: "object" } }), NOW), null);
});

test("invalid time inputs are rejected", () => {
  assert.equal(makeAthenaEstimateDraft(["Deck"], NaN), null);
  assert.equal(readAthenaEstimateDraft(JSON.stringify({ version: 1, createdAt: "now", scope: "Deck" }), NOW), null);
});
