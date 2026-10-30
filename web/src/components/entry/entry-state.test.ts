import test from "node:test";
import assert from "node:assert/strict";
import {
  ENTRY_TIMING,
  GREETINGS,
  getVisitKind,
  isSoftwareRendererName,
  nextGreeting,
  rememberVisit,
  validateCredentials,
  type EntryStorage,
} from "./entry-state.ts";
const memory = (): EntryStorage => {
  const values = new Map<string, string>();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      values.set(k, v);
    },
  };
};
test("first and returning timing follows the approved brand experience", () => {
  const storage = memory();
  assert.equal(getVisitKind(storage), "first");
  assert.equal(ENTRY_TIMING.first, 4000);
  rememberVisit(storage);
  assert.equal(getVisitKind(storage), "returning");
  assert.equal(ENTRY_TIMING.returning, 2500);
});
test("blocked storage never blocks entry and greetings cycle without repeats", () => {
  const blocked: EntryStorage = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  assert.equal(getVisitKind(blocked), "first");
  assert.doesNotThrow(() => rememberVisit(blocked));
  assert.equal(nextGreeting(blocked), GREETINGS[0]);
  const storage = memory();
  const actual = Array.from({ length: GREETINGS.length + 1 }, () =>
    nextGreeting(storage),
  );
  assert.equal(new Set(actual.slice(0, -1)).size, GREETINGS.length);
  assert.equal(actual[0], actual.at(-1));
});
test("software rasterizers are detected so the intro skips the environment pass", () => {
  assert.equal(isSoftwareRendererName("Google SwiftShader"), true);
  assert.equal(isSoftwareRendererName("llvmpipe (LLVM 15.0.7, 256 bits)"), true);
  assert.equal(isSoftwareRendererName("Mesa Software Renderer"), true);
  assert.equal(
    isSoftwareRendererName(
      "ANGLE (NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0)",
    ),
    false,
  );
  assert.equal(isSoftwareRendererName("Apple M1 Pro"), false);
  assert.equal(isSoftwareRendererName(""), false);
});
test("validation rejects empty/malformed values but preserves password-manager input", () => {
  assert.deepEqual(validateCredentials("", ""), {
    email: "Enter a valid email address.",
    password: "Enter your password.",
  });
  assert.equal(
    validateCredentials("invalid", "correct horse battery staple").email,
    "Enter a valid email address.",
  );
  assert.deepEqual(
    validateCredentials(
      " owner@example.test ",
      "pass phrase pasted by manager",
    ),
    {},
  );
});
