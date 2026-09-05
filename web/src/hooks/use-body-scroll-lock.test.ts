import assert from "node:assert/strict";
import test from "node:test";
import { acquireBodyScrollLock } from "./use-body-scroll-lock.ts";

test("body scroll lock restores the original overflow after the last overlay closes", () => {
  const previousDocument = globalThis.document;
  const style = { overflow: "auto" };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { body: { style } },
  });

  try {
    const releaseSheet = acquireBodyScrollLock();
    const releasePalette = acquireBodyScrollLock();

    assert.equal(style.overflow, "hidden");
    releaseSheet();
    assert.equal(style.overflow, "hidden");
    releasePalette();
    assert.equal(style.overflow, "auto");

    releasePalette();
    assert.equal(style.overflow, "auto");
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previousDocument,
    });
  }
});
