import test from "node:test";
import assert from "node:assert/strict";
import { parseInvoiceDueDate } from "./invoice-due-date.ts";

test("invoice due date accepts typed US numeric dates", () => {
  assert.deepEqual(parseInvoiceDueDate("11/20/2026"), { date: "2026-11-20" });
  assert.deepEqual(parseInvoiceDueDate("2/9/2028"), { date: "2028-02-09" });
});

test("invoice due date preserves ISO format for API persistence", () => {
  assert.deepEqual(parseInvoiceDueDate("2026-11-20"), { date: "2026-11-20" });
});

test("blank optional invoice due date remains clearable", () => {
  assert.deepEqual(parseInvoiceDueDate(""), { date: null });
  assert.deepEqual(parseInvoiceDueDate("   "), { date: null });
});

test("invoice due date rejects invalid calendar dates rather than silently normalizing", () => {
  for (const raw of ["02/29/2027", "2026-02-30", "13/01/2026", "11/31/2026", "11/20/26", "tomorrow"]) {
    assert.deepEqual(parseInvoiceDueDate(raw), { error: "Enter a valid due date (MM/DD/YYYY or YYYY-MM-DD)." });
  }
});

test("invoice due date accepts leap day in a leap year", () => {
  assert.deepEqual(parseInvoiceDueDate("02/29/2028"), { date: "2028-02-29" });
});
