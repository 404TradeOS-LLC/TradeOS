import assert from "node:assert/strict";
import test from "node:test";
import {
  ATHENA_ESTIMATE_DRAFT_KEY,
  buildAthenaEstimateIdentity,
  makeAthenaEstimateDraft,
  readAthenaEstimateDraft,
} from "./athena-estimate-handoff.ts";

const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);
const OWNER = buildAthenaEstimateIdentity("user-a", "org-a");
const OTHER_USER = buildAthenaEstimateIdentity("user-b", "org-a");
const OTHER_ORG = buildAthenaEstimateIdentity("user-a", "org-b");

test("review-only estimate identity binds both signed-in person and organization", () => {
  assert.ok(OWNER && OTHER_USER && OTHER_ORG);
  assert.notEqual(OWNER, OTHER_USER);
  assert.notEqual(OWNER, OTHER_ORG);
  assert.equal(buildAthenaEstimateIdentity("", "org-a"), null);
  assert.equal(buildAthenaEstimateIdentity("user-a", undefined), null);
  assert.equal(buildAthenaEstimateIdentity(" ", "org-a"), null);
});

test("Athena estimate handoff contains only edited contractor notes in order", () => {
  assert.ok(OWNER);
  const raw = makeAthenaEstimateDraft(["  Build a deck. ", "", " 12 by 16 feet. "], NOW, OWNER);
  assert.ok(raw);
  assert.equal(ATHENA_ESTIMATE_DRAFT_KEY, "tradeos:athena-estimate-draft:v1");
  assert.equal(readAthenaEstimateDraft(raw, NOW + 1000, OWNER), "Build a deck.\n\n12 by 16 feet.");
});

test("removed notes are excluded and no note is silently truncated", () => {
  assert.ok(OWNER);
  const raw = makeAthenaEstimateDraft(["Retain this note", "  "], NOW, OWNER);
  assert.equal(readAthenaEstimateDraft(raw, NOW, OWNER), "Retain this note");
  assert.equal(makeAthenaEstimateDraft(["x".repeat(2000), "y".repeat(2000)], NOW, OWNER), null);
  assert.equal(makeAthenaEstimateDraft(["x".repeat(4001)], NOW, OWNER), null);
});

test("an empty or identity-free draft is refused before browser storage", () => {
  assert.equal(makeAthenaEstimateDraft([" ", "\n"], NOW, OWNER ?? ""), null);
  assert.equal(makeAthenaEstimateDraft(["Build deck"], NOW, ""), null);
});

test("a later user or switched organization cannot consume the previous actor's notes", () => {
  assert.ok(OWNER && OTHER_USER && OTHER_ORG);
  const raw = makeAthenaEstimateDraft(["Customer deck scope"], NOW, OWNER);
  assert.ok(raw);
  assert.equal(readAthenaEstimateDraft(raw, NOW, OTHER_USER), null);
  assert.equal(readAthenaEstimateDraft(raw, NOW, OTHER_ORG), null);
  assert.equal(readAthenaEstimateDraft(raw, NOW, ""), null);
  assert.equal(readAthenaEstimateDraft(raw, NOW, OWNER), "Customer deck scope");
});

test("expired, future-dated, and malformed data never autofill the form", () => {
  assert.ok(OWNER);
  const raw = makeAthenaEstimateDraft(["Replace two doors"], NOW, OWNER);
  assert.ok(raw);
  assert.equal(readAthenaEstimateDraft(raw, NOW + 5 * 60_000 + 1, OWNER), null);
  assert.equal(readAthenaEstimateDraft(raw, NOW - 1, OWNER), null);
  assert.equal(readAthenaEstimateDraft("not-json", NOW, OWNER), null);
  assert.equal(readAthenaEstimateDraft(null, NOW, OWNER), null);
});

test("unexpected versions and forged payloads cannot autofill scope", () => {
  assert.ok(OWNER);
  assert.equal(readAthenaEstimateDraft(JSON.stringify({ version: 2, createdAt: NOW, scope: "bad", identity: OWNER }), NOW, OWNER), null);
  assert.equal(readAthenaEstimateDraft(JSON.stringify({ version: 1, createdAt: NOW, scope: "z".repeat(4001), identity: OWNER }), NOW, OWNER), null);
  assert.equal(readAthenaEstimateDraft(JSON.stringify({ version: 1, createdAt: NOW, scope: { unexpected: "object" }, identity: OWNER }), NOW, OWNER), null);
  assert.equal(readAthenaEstimateDraft(JSON.stringify({ version: 1, createdAt: NOW, scope: "bad" }), NOW, OWNER), null);
});

test("invalid time inputs are rejected", () => {
  assert.ok(OWNER);
  assert.equal(makeAthenaEstimateDraft(["Deck"], NaN, OWNER), null);
  assert.equal(readAthenaEstimateDraft(JSON.stringify({ version: 1, createdAt: "now", scope: "Deck", identity: OWNER }), NOW, OWNER), null);
});
