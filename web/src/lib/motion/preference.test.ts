import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseStoredMotionPreference,
  resolveMotionPreference,
} from "./preference.ts";

const here = dirname(fileURLToPath(import.meta.url));

async function readSource(relative: string): Promise<string> {
  return readFile(join(here, relative), "utf8");
}

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

test("the stored preference is initialized at the app root", async () => {
  // Nothing mounts useMotionPreference on its own, so a stored "reduced"
  // preference would never reach <html data-motion> without an app-root
  // mount. The initializer mounts the hook once, and Providers renders it.
  const initializer = await readSource("motion-preference-initializer.tsx");
  assert.match(initializer, /useMotionPreference\(\);/);
  const providers = await readSource("../../app/providers.tsx");
  assert.match(providers, /<MotionPreferenceInitializer \/>/);
});
