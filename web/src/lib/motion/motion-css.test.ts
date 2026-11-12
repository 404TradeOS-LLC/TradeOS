import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MOTION_DISPLACEMENT_PX, MOTION_DURATIONS_MS, MOTION_EASINGS } from "./tokens.ts";

// Guards tokens.ts / motion.css drift: the CSS collection must carry the
// same durations, easings, stagger cap, and displacement as the TS tokens,
// and must alias the production tokens where the spec value already exists.
const css = readFileSync(new URL("./motion.css", import.meta.url), "utf8");

test("motion.css carries every token duration, literally or via its alias", () => {
  // micro (120ms) and resolve (320ms) appear only as aliases --dur-1 /
  // --dur-3; the alias test below pins that mapping. The rest are literal.
  const literalMs = new Set(
    Object.entries(MOTION_DURATIONS_MS)
      .filter(([name]) => name !== "micro" && name !== "resolve")
      .map(([, ms]) => `${ms}ms`),
  );
  for (const ms of literalMs) {
    assert.ok(css.includes(ms), `motion.css missing ${ms}`);
  }
});

test("motion.css carries every token easing, literally or via its alias", () => {
  // settle appears only as var(--ease-emphasized); the alias test pins that.
  assert.ok(css.includes(MOTION_EASINGS.transit), "motion.css missing transit easing");
  assert.ok(css.includes(MOTION_EASINGS.exit), "motion.css missing exit easing");
});

test("motion.css aliases production tokens instead of restating them", () => {
  assert.ok(css.includes("var(--dur-1)"), "micro should alias --dur-1 (120ms)");
  assert.ok(css.includes("var(--dur-3)"), "resolve should alias --dur-3 (320ms)");
  assert.ok(css.includes("var(--ease-emphasized)"), "settle should alias --ease-emphasized");
});

test("motion.css carries the stagger cap, displacement, and reduced variants", () => {
  assert.ok(css.includes("35ms"), "stagger 35ms missing");
  assert.ok(css.includes("105ms"), "stagger cap 105ms missing");
  // Exact declaration against the TypeScript token: a bare "4px"
  // substring would also accept 14px. The hidden resolve item must
  // travel by the token variable, not a restated literal.
  assert.match(
    css,
    new RegExp(`--motion-displacement:\\s*${MOTION_DISPLACEMENT_PX}px;`),
    "displacement must be the exact token declaration",
  );
  assert.match(
    css,
    /transform:\s*translateY\(var\(--motion-displacement\)\);/,
    "hidden resolve item must travel by the displacement token",
  );
  assert.ok(css.includes("prefers-reduced-motion"), "reduced-motion media block missing");
  assert.ok(css.includes('[data-motion="reduced"]'), "stored-preference reduced block missing");
});

test("motion.css keeps the advance marker positioned under reduced motion", () => {
  // The marker is positioned by an inline translateX transform: a reduced
  // reset would pin it under the first stage. Both reduced blocks drop the
  // marker's travel without resetting its transform, and the marker no
  // longer sits in either transform-resetting group. Whitespace-insensitive:
  // an indentation change must not fail these assertions.
  assert.match(
    css,
    /\.motion-advance-marker\s*\{\s*transition:\s*none\s*!important;\s*\}/,
    "media reduced block must drop marker travel without resetting transform",
  );
  assert.match(
    css,
    /\[data-motion="reduced"\]\s*\.motion-advance-marker\s*\{\s*transition:\s*none\s*!important;\s*\}/,
    "stored-preference reduced block must drop marker travel without resetting transform",
  );
  assert.match(css, /\.motion-price-delta-value,\s*\.motion-complete-label\s*\{/);
  assert.match(
    css,
    /\[data-motion="reduced"\]\s*\.motion-price-delta-value,\s*\[data-motion="reduced"\]\s*\.motion-complete-label\s*\{/,
  );
});
