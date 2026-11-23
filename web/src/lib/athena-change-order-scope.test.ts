import assert from "node:assert/strict";
import test from "node:test";

import { describeLatestChangeOrder } from "./athena-change-order-scope.ts";

test("describeLatestChangeOrder returns null with no change orders", () => {
  assert.equal(describeLatestChangeOrder(null), null);
  assert.equal(describeLatestChangeOrder(undefined), null);
  assert.equal(describeLatestChangeOrder([]), null);
});

test("describeLatestChangeOrder formats the Figma rail row", () => {
  assert.deepEqual(describeLatestChangeOrder([{ coNumber: 4, status: "draft", amount: 1850 }]), {
    label: "Change order",
    detail: "CO-4 · Draft · +$1,850",
  });
});

test("describeLatestChangeOrder picks the highest CO number, not input order", () => {
  assert.deepEqual(
    describeLatestChangeOrder([
      { coNumber: 4, status: "draft", amount: 1850 },
      { coNumber: 1, status: "approved", amount: 500 },
      { coNumber: 2, status: "rejected", amount: -250 },
    ]),
    { label: "Change order", detail: "CO-4 · Draft · +$1,850" }
  );
  assert.deepEqual(
    describeLatestChangeOrder([
      { coNumber: 1, status: "approved", amount: 500 },
      { coNumber: 2, status: "approved", amount: -250 },
    ]),
    { label: "Change order", detail: "CO-2 · Approved · -$250" }
  );
});

test("describeLatestChangeOrder labels every known status and signs a zero amount", () => {
  assert.deepEqual(describeLatestChangeOrder([{ coNumber: 1, status: "rejected", amount: 0 }]), {
    label: "Change order",
    detail: "CO-1 · Rejected · +$0",
  });
  assert.deepEqual(
    describeLatestChangeOrder([{ coNumber: 3, status: "in_review", amount: 100 }]),
    { label: "Change order", detail: "CO-3 · In review · +$100" }
  );
});

test("describeLatestChangeOrder skips unusable entries instead of inventing a price", () => {
  assert.equal(
    describeLatestChangeOrder([
      { coNumber: Number.NaN, status: "draft", amount: 1850 },
      { coNumber: 2, status: "draft", amount: Number.NaN },
    ]),
    null
  );
  assert.deepEqual(
    describeLatestChangeOrder([
      { coNumber: Number.NaN, status: "draft", amount: 1850 },
      { coNumber: 2, status: "draft", amount: 400 },
    ]),
    { label: "Change order", detail: "CO-2 · Draft · +$400" }
  );
});
