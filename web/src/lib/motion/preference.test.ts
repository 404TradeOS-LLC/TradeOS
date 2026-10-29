import test from "node:test";
import assert from "node:assert/strict";
import {
  parseStoredMotionPreference,
  resolveMotionPreference,
} from "./preference.ts";

test("reduced motion wins over both the media query and the stored preference", () => {
  assert.equal(
    resolveMotionPreference({ prefersReducedMotion: true, storedPreference: null }),
    "reduced",
  );
  assert.equal(
    resolveMotionPreference({ prefersReducedMotion: true, storedPreference: "full" }),
    "reduced",
  );
  assert.equal(
    resolveMotionPreference({ prefersReducedMotion: false, storedPreference: "reduced" }),
    "reduced",
  );
});

test("full motion requires neither source to ask for reduced", () => {
  assert.equal(
    resolveMotionPreference({ prefersReducedMotion: false, storedPreference: "full" }),
    "full",
  );
  assert.equal(
    resolveMotionPreference({ prefersReducedMotion: false, storedPreference: null }),
    "full",
  );
});

test("only exact stored values parse; anything else is no preference", () => {
  assert.equal(parseStoredMotionPreference("reduced"), "reduced");
  assert.equal(parseStoredMotionPreference("full"), "full");
  assert.equal(parseStoredMotionPreference("bogus"), null);
  assert.equal(parseStoredMotionPreference(null), null);
});
