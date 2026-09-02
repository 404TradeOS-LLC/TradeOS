import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectActivityEntries, mergeActivityEntries } from "./project-activity-model.ts";
import type { ActivityEvent } from "../../lib/api.ts";
import type { OwnerActivityEntry } from "./owner-dashboard-data.ts";

function event(overrides: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: "e1",
    entityType: "project",
    entityId: "p1",
    eventType: "proposal.sent",
    title: "Proposal sent",
    description: null,
    actorUserId: null,
    metadata: null,
    occurredAt: "2026-08-01T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

test("buildProjectActivityEntries maps recognized document-workflow event types to friendly titles and categories", () => {
  const [entry] = buildProjectActivityEntries([event({ eventType: "contract.signed" })]);
  assert.equal(entry.title, "Contract signed");
  assert.equal(entry.category, "Contract");
  assert.equal(entry.tone, "success");
});

test("buildProjectActivityEntries treats invoice.paid as a success-tone payment-recorded event", () => {
  const [entry] = buildProjectActivityEntries([event({ eventType: "invoice.paid" })]);
  assert.equal(entry.title, "Payment recorded");
  assert.equal(entry.category, "Invoice");
  assert.equal(entry.tone, "success");
});

test("buildProjectActivityEntries flags voided/declined events with a warning tone", () => {
  const [declined] = buildProjectActivityEntries([event({ eventType: "proposal.declined" })]);
  assert.equal(declined.tone, "warning");

  const [voided] = buildProjectActivityEntries([event({ eventType: "contract.voided" })]);
  assert.equal(voided.tone, "warning");
});

test("buildProjectActivityEntries falls back to the event's own title for an unrecognized event type instead of dropping it", () => {
  const [entry] = buildProjectActivityEntries([event({ eventType: "project.archived", title: "Project archived" })]);
  assert.equal(entry.title, "Project archived");
  assert.equal(entry.category, "Project");
  assert.equal(entry.tone, "info");
});

test("buildProjectActivityEntries attributes an actor user id and falls back to TradeOS when absent", () => {
  const [withActor] = buildProjectActivityEntries([event({ actorUserId: "user-1" })]);
  assert.equal(withActor.actor, "User user-1");

  const [withoutActor] = buildProjectActivityEntries([event({ actorUserId: null })]);
  assert.equal(withoutActor.actor, "TradeOS");
});

function ownerEntry(overrides: Partial<OwnerActivityEntry>): OwnerActivityEntry {
  return {
    id: "a1",
    title: "Task moved",
    description: "desc",
    occurredAt: "2026-08-01T00:00:00.000Z",
    category: "Task",
    actor: "TradeOS",
    tone: "info",
    ...overrides,
  };
}

test("mergeActivityEntries interleaves both feeds newest-occurredAt-first", () => {
  const taskEntries = [ownerEntry({ id: "t1", occurredAt: "2026-08-01T00:00:00.000Z" })];
  const projectEntries = [ownerEntry({ id: "p1", occurredAt: "2026-08-05T00:00:00.000Z" })];

  const merged = mergeActivityEntries(taskEntries, projectEntries);

  assert.deepEqual(merged.map((entry) => entry.id), ["p1", "t1"]);
});

test("mergeActivityEntries respects the limit across both feeds combined", () => {
  const taskEntries = [ownerEntry({ id: "t1" }), ownerEntry({ id: "t2" })];
  const projectEntries = [ownerEntry({ id: "p1" }), ownerEntry({ id: "p2" })];

  const merged = mergeActivityEntries(taskEntries, projectEntries, 3);

  assert.equal(merged.length, 3);
});
