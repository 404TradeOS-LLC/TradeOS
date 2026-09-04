import test from "node:test";
import assert from "node:assert/strict";
import { buildContinueWorkingRows, type ContinueWorkingProjectInput } from "./continue-working-model.ts";

function project(overrides: Partial<ContinueWorkingProjectInput>): ContinueWorkingProjectInput {
  return {
    id: "p1",
    name: "Kitchen remodel",
    status: "active",
    customer: { name: "Jane Doe" },
    proposals: [],
    contracts: [],
    invoices: [],
    jobs: [],
    ...overrides,
  };
}

test("a signed contract with no scheduled job surfaces scheduling_needed", () => {
  const rows = buildContinueWorkingRows([
    project({ contracts: [{ id: "c1", status: "signed", createdAt: "2026-08-01T00:00:00.000Z" }] }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].stage, "scheduling_needed");
  assert.equal(rows[0].href, "/dispatch");
});

test("a signed contract with a scheduled (non-unscheduled) job produces no row", () => {
  const rows = buildContinueWorkingRows([
    project({
      contracts: [{ id: "c1", status: "signed", createdAt: "2026-08-01T00:00:00.000Z" }],
      jobs: [{ id: "j1", status: "scheduled", archivedAt: null }],
    }),
  ]);

  assert.equal(rows.length, 0);
});

test("an accepted proposal with no contract surfaces contract_needed", () => {
  const rows = buildContinueWorkingRows([
    project({ proposals: [{ id: "pr1", status: "accepted", createdAt: "2026-08-01T00:00:00.000Z" }] }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].stage, "contract_needed");
});

test("an accepted proposal whose only contract was voided still surfaces contract_needed", () => {
  const rows = buildContinueWorkingRows([
    project({
      proposals: [{ id: "pr1", status: "accepted", createdAt: "2026-08-01T00:00:00.000Z" }],
      contracts: [{ id: "c1", status: "voided", createdAt: "2026-08-02T00:00:00.000Z" }],
    }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].stage, "contract_needed");
});

test("a draft (unsent) proposal surfaces proposal_not_sent and links to that proposal", () => {
  const rows = buildContinueWorkingRows([
    project({ proposals: [{ id: "pr1", status: "draft", createdAt: "2026-08-01T00:00:00.000Z" }] }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].stage, "proposal_not_sent");
  assert.equal(rows[0].href, "/projects/p1/proposals/pr1");
});

test("a completed job with no invoice yet surfaces invoice_needed and outranks earlier stages", () => {
  const rows = buildContinueWorkingRows([
    project({
      proposals: [{ id: "pr1", status: "accepted", createdAt: "2026-08-01T00:00:00.000Z" }],
      contracts: [{ id: "c1", status: "signed", createdAt: "2026-08-02T00:00:00.000Z" }],
      jobs: [{ id: "j1", status: "completed", archivedAt: null }],
    }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].stage, "invoice_needed");
});

test("a completed job that already has an invoice does not surface invoice_needed", () => {
  const rows = buildContinueWorkingRows([
    project({
      jobs: [{ id: "j1", status: "completed", archivedAt: null }],
      invoices: [{ id: "inv1" }],
    }),
  ]);

  assert.equal(rows.length, 0);
});

test("an archived project never surfaces a row, even with an otherwise-matching signed contract", () => {
  const rows = buildContinueWorkingRows([
    project({ status: "archived", contracts: [{ id: "c1", status: "signed", createdAt: "2026-08-01T00:00:00.000Z" }] }),
  ]);

  assert.equal(rows.length, 0);
});

test("a project with no proposals, contracts, invoices, or jobs produces no row (no false positives)", () => {
  const rows = buildContinueWorkingRows([project({})]);
  assert.equal(rows.length, 0);
});

test("an archived (empty) project list produces an empty result", () => {
  assert.deepEqual(buildContinueWorkingRows([]), []);
});

test("rows are ordered furthest-along-stage first across projects", () => {
  const rows = buildContinueWorkingRows([
    project({ id: "p-proposal", name: "Proposal project", proposals: [{ id: "pr1", status: "draft", createdAt: "2026-08-01T00:00:00.000Z" }] }),
    project({ id: "p-invoice", name: "Invoice project", jobs: [{ id: "j1", status: "completed", archivedAt: null }] }),
    project({
      id: "p-schedule",
      name: "Schedule project",
      contracts: [{ id: "c1", status: "signed", createdAt: "2026-08-01T00:00:00.000Z" }],
    }),
  ]);

  assert.deepEqual(
    rows.map((row) => row.projectId),
    ["p-invoice", "p-schedule", "p-proposal"],
  );
});

test("within the same stage, the older (longer-idle) project sorts first", () => {
  const rows = buildContinueWorkingRows([
    project({ id: "p-newer", contracts: [{ id: "c1", status: "signed", createdAt: "2026-08-10T00:00:00.000Z" }] }),
    project({ id: "p-older", contracts: [{ id: "c1", status: "signed", createdAt: "2026-08-01T00:00:00.000Z" }] }),
  ]);

  assert.deepEqual(
    rows.map((row) => row.projectId),
    ["p-older", "p-newer"],
  );
});

test("respects the limit parameter", () => {
  const projects = Array.from({ length: 10 }, (_, index) =>
    project({ id: `p${index}`, contracts: [{ id: `c${index}`, status: "signed", createdAt: "2026-08-01T00:00:00.000Z" }] }),
  );

  const rows = buildContinueWorkingRows(projects, 3);
  assert.equal(rows.length, 3);
});

test("customer name falls back to 'No customer linked'", () => {
  const rows = buildContinueWorkingRows([
    project({ customer: null, proposals: [{ id: "pr1", status: "draft", createdAt: "2026-08-01T00:00:00.000Z" }] }),
  ]);

  assert.equal(rows[0].customerName, "No customer linked");
});
