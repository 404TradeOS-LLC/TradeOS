import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompositeImportBatches,
  MAX_BATCH_BYTES,
  MAX_BATCH_ROWS,
} from "./import-batches.ts";

test("splits composite imports at the row limit", () => {
  const rows = Array.from({ length: MAX_BATCH_ROWS + 1 }, (_, index) => ({ code: `row-${index}` }));

  const batches = buildCompositeImportBatches(rows);

  assert.equal(batches.length, 2);
  assert.equal(batches[0]?.length, MAX_BATCH_ROWS);
  assert.equal(batches[1]?.length, 1);
});

test("splits batches before their encoded request body exceeds the byte limit", () => {
  const payload = "x".repeat(Math.floor(MAX_BATCH_BYTES / 2));

  const batches = buildCompositeImportBatches([
    { code: "first", payload },
    { code: "second", payload },
  ]);

  assert.equal(batches.length, 2);
  for (const batch of batches) {
    const bytes = new TextEncoder().encode(JSON.stringify({ rows: batch })).byteLength;
    assert.ok(bytes <= MAX_BATCH_BYTES);
  }
});

test("rejects a single row that cannot fit under the request body limit", () => {
  const oversizedRow = { code: "oversized", payload: "x".repeat(MAX_BATCH_BYTES) };

  assert.throws(
    () => buildCompositeImportBatches([oversizedRow]),
    /too large to send safely/
  );
});
