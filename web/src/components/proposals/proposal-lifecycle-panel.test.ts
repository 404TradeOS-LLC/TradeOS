import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("./proposal-lifecycle-panel.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../../app/actions/proposals.ts", import.meta.url), "utf8");
const timeline = readFileSync(new URL("../../lib/document-workflow.ts", import.meta.url), "utf8");

test("draft proposals expose a separate confirmed offline acceptance form", () => {
  assert.match(panel, /proposal.status === "draft" && \(\s*<form action=\{offlineFormAction\}/);
  assert.match(panel, /name="channel"/);
  assert.match(panel, /name="note"/);
  assert.match(panel, /name="confirmed" value="true" required/);
  assert.match(panel, /Record offline acceptance/);
  assert.match(panel, /does not email the proposal or create a customer signature/);
});

test("offline approval posts to its dedicated endpoint, not the send or portal acceptance endpoint", () => {
  assert.match(actions, /export async function acceptOfflineProposalAction/);
  assert.match(actions, /\/accept-offline/);
  assert.match(actions, /JSON.stringify\(\{ channel, note, confirmed \}\)/);
  assert.match(actions, /if \(!confirmed \|\|/);
});

test("offline approval is distinguished from delivery in the proposal timeline", () => {
  assert.match(timeline, /staff_recorded_offline/);
  assert.match(timeline, /Proposal accepted offline/);
});
