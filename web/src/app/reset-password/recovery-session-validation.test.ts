import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveInitialRecoveryState,
  resolveRecoverySessionState,
} from "./recovery-session-state.ts";

test("legacy backend-token links bypass Supabase recovery-session validation", () => {
  assert.deepEqual(resolveInitialRecoveryState("legacy-token", "", false), {
    kind: "legacy-token",
    token: "legacy-token",
  });
});

test("explicit recovery errors fail before session validation", () => {
  assert.deepEqual(resolveInitialRecoveryState("", "invalid-link", true), {
    kind: "explicit-error",
    error: "invalid-link",
  });
});

test("missing recovery marker fails closed", () => {
  assert.deepEqual(resolveInitialRecoveryState("", "", false), { kind: "invalid-link" });
});

test("recovery marker requires live session verification", () => {
  assert.deepEqual(resolveInitialRecoveryState("", "", true), { kind: "verify-session" });
});

test("stale marker paired with a valid non-recovery session fails closed", () => {
  // The boolean represents an exact user-id match between the exchanged
  // recovery marker and the currently authenticated Supabase user.
  assert.deepEqual(resolveRecoverySessionState(false, false), { kind: "invalid-link" });
});

test("stale marker with no Supabase user fails closed", () => {
  assert.deepEqual(resolveRecoverySessionState(false, false), { kind: "invalid-link" });
});

test("Supabase session errors fail closed even when a user value is present", () => {
  assert.deepEqual(resolveRecoverySessionState(true, true), { kind: "invalid-link" });
});

test("only a live error-free Supabase user can render the native reset form", () => {
  assert.deepEqual(resolveRecoverySessionState(true, false), { kind: "reset-form" });
});
