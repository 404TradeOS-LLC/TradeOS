import test from "node:test";
import assert from "node:assert/strict";
import {
  draftCategories,
  invoiceLifecycle,
  jobLifecycle,
} from "./adapters.ts";

test("job lifecycle maps each linear status to current plus prior stages", () => {
  assert.deepEqual(jobLifecycle("scheduled"), { current: "scheduled", completed: [] });
  assert.deepEqual(jobLifecycle("dispatched"), { current: "dispatched", completed: ["scheduled"] });
  assert.deepEqual(jobLifecycle("traveling"), {
    current: "traveling",
    completed: ["scheduled", "dispatched"],
  });
  assert.deepEqual(jobLifecycle("on_site"), {
    current: "on_site",
    completed: ["scheduled", "dispatched", "traveling"],
  });
  assert.deepEqual(jobLifecycle("completed"), {
    current: "completed",
    completed: ["scheduled", "dispatched", "traveling", "on_site"],
  });
});

test("job lifecycle returns null for statuses with no progression position", () => {
  assert.equal(jobLifecycle("unscheduled"), null);
  assert.equal(jobLifecycle("paused"), null);
  assert.equal(jobLifecycle("cancelled"), null);
  assert.equal(jobLifecycle("todo"), null);
  assert.equal(jobLifecycle(""), null);
});

test("invoice lifecycle derives completion from record fields, not stage order", () => {
  assert.deepEqual(
    invoiceLifecycle({ status: "draft", sentAt: null, payments: [], balanceDue: 100 }),
    { current: "draft", completed: [] },
  );
  assert.deepEqual(
    invoiceLifecycle({ status: "sent", sentAt: "2026-10-01T00:00:00Z", payments: [], balanceDue: 100 }),
    { current: "sent", completed: ["draft"] },
  );
  assert.deepEqual(
    invoiceLifecycle({ status: "viewed", sentAt: "2026-10-01T00:00:00Z", payments: [], balanceDue: 100 }),
    { current: "viewed", completed: ["draft", "sent"] },
  );
  // Viewed is never claimed completed: no view timestamp or delivery
  // vocabulary exists on the record, so it stays upcoming (not recorded).
  assert.deepEqual(
    invoiceLifecycle({ status: "partially_paid", sentAt: "2026-10-01T00:00:00Z", payments: [{ amount: 50 }], balanceDue: 50 }),
    { current: "partially_paid", completed: ["draft", "sent"] },
  );
  assert.deepEqual(
    invoiceLifecycle({ status: "paid", sentAt: "2026-10-01T00:00:00Z", payments: [{ amount: 100 }], balanceDue: 0 }),
    { current: "paid", completed: ["draft", "sent", "partially_paid"] },
  );
});

test("invoice lifecycle skips non-linear, inconsistent, and unreconciled states", () => {
  const base = { sentAt: "2026-10-01T00:00:00Z", payments: [{ amount: 100 }], balanceDue: 0 };
  assert.equal(invoiceLifecycle({ ...base, status: "overdue", balanceDue: 50 }), null);
  assert.equal(invoiceLifecycle({ ...base, status: "voided" }), null);
  assert.equal(invoiceLifecycle({ ...base, status: "paid", balanceDue: 25 }), null);
  assert.equal(invoiceLifecycle({ ...base, status: "paid", balanceDue: -10 }), null);
  assert.equal(invoiceLifecycle({ ...base, status: "paid", balanceDue: Number.NaN }), null);
  assert.equal(invoiceLifecycle({ ...base, status: "refunded" }), null);
});

test("draft categories come verbatim from the payload, in payload order", () => {
  assert.deepEqual(
    draftCategories({
      lineItems: [
        { description: "Architectural shingles" },
        { description: "Synthetic underlayment" },
      ],
    }),
    ["Architectural shingles", "Synthetic underlayment"],
  );
  assert.deepEqual(draftCategories(null), []);
  assert.deepEqual(draftCategories({ lineItems: [] }), []);
});
