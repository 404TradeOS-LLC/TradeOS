import test from "node:test";
import assert from "node:assert/strict";
import { submitInvoiceDraft, type InvoiceAttempt } from "./submit-invoice-draft.ts";

function draft(key: string, amount: string) {
  const data = new FormData();
  data.set("createRequestKey", key);
  data.set("lineUnitPrice0", amount);
  return data;
}

test("lost action response retains the original key and values through a later rejection", async () => {
  const retained: { current: InvoiceAttempt | null } = { current: null };
  const original = draft("key-1", "300");
  const edited = draft("key-2", "400");
  const lost = await submitInvoiceDraft(retained, original, async () => { throw new Error("connection lost"); });
  assert.ok("unconfirmed" in lost && lost.unconfirmed);
  const denied = await submitInvoiceDraft(retained, edited, async (data) => {
    assert.equal(data.get("createRequestKey"), "key-1");
    assert.equal(data.get("lineUnitPrice0"), "300");
    return { error: "Sign in again" };
  });
  assert.deepEqual(denied, { error: "Sign in again", unconfirmed: true });
  const recovered = await submitInvoiceDraft(retained, edited, async (data) => {
    assert.equal(data, original);
    return { invoiceId: "existing-draft" };
  });
  assert.deepEqual(recovered, { invoiceId: "existing-draft" });
  assert.equal(retained.current, null);
});

test("a definitive initial validation error allows corrected invoice values", async () => {
  const retained: { current: InvoiceAttempt | null } = { current: null };
  await submitInvoiceDraft(retained, draft("key-1", "0"), async () => ({ error: "Invalid line" }));
  assert.equal(retained.current, null);
  await submitInvoiceDraft(retained, draft("key-1", "300"), async (data) => {
    assert.equal(data.get("lineUnitPrice0"), "300");
    return { invoiceId: "draft" };
  });
});
