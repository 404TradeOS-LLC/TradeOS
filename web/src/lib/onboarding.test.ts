import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_SCOPE_TEXT_LENGTH,
  ONBOARDING_EXAMPLE_SCOPES,
  ONBOARDING_WORK_TYPES,
  deriveProjectNameFromScope,
  shouldRedirectToOnboarding,
  validateOnboardingInput,
} from "./onboarding.ts";

const EXAMPLE_SCOPE =
  "Paint a 2.5-car garage floor. The old coating is worn in traffic areas. Customer wants a beige/tan finish and wants it done before next weekend.";

test("deriveProjectNameFromScope uses the first sentence, capped at eight words", () => {
  assert.equal(deriveProjectNameFromScope(EXAMPLE_SCOPE), "Paint a 2.5-car garage floor");
  assert.equal(deriveProjectNameFromScope("  Remodel a small kitchen   for a family of five.  "), "Remodel a small kitchen for a family of");
  assert.equal(deriveProjectNameFromScope(""), "First estimate");
  assert.equal(deriveProjectNameFromScope("   "), "First estimate");
});

test("deriveProjectNameFromScope truncates a long first sentence", () => {
  const name = deriveProjectNameFromScope(
    "Rehabilitate the extraordinarily deteriorated weather-exposed south-facing second-story cedar-shake roofing system completely",
  );
  assert.ok(name.length <= 80);
  assert.ok(name.endsWith("…"));
  assert.equal(name.startsWith("Rehabilitate the extraordinarily"), true);
});

test("validateOnboardingInput requires a known work type and a real scope", () => {
  assert.deepEqual(validateOnboardingInput({ workTypes: [], scopeText: EXAMPLE_SCOPE }).error, "Choose at least one type of work to continue.");
  assert.deepEqual(
    validateOnboardingInput({ workTypes: ["Painting"], scopeText: "Too short" }).error,
    "Describe the job in a sentence or two so Athena has something real to draft from.",
  );
  assert.deepEqual(
    validateOnboardingInput({ workTypes: ["Not a trade"], scopeText: EXAMPLE_SCOPE }).error,
    "Choose at least one type of work to continue.",
  );

  const valid = validateOnboardingInput({ workTypes: ["Painting", "Remodeling"], scopeText: `  ${EXAMPLE_SCOPE}  ` });
  assert.equal(valid.error, null);
  assert.deepEqual(valid.value, { workTypes: ["Painting", "Remodeling"], scopeText: EXAMPLE_SCOPE });

  const tooLong = validateOnboardingInput({ workTypes: ["Painting"], scopeText: "x".repeat(10_001) });
  assert.match(tooLong.error ?? "", /too long/);
});

test("scope minimum matches the composer's ten-character floor", () => {
  assert.equal(MIN_SCOPE_TEXT_LENGTH, 10);
  assert.equal(validateOnboardingInput({ workTypes: ["Painting"], scopeText: "123456789" }).value, null);
  assert.notEqual(validateOnboardingInput({ workTypes: ["Painting"], scopeText: "1234567890" }).value, null);
});

test("example scopes ship the Figma garage-floor job verbatim", () => {
  const painting = ONBOARDING_EXAMPLE_SCOPES.find((example) => example.label === "Interior painting");
  assert.equal(painting?.scope, EXAMPLE_SCOPE);
  assert.deepEqual(
    ONBOARDING_EXAMPLE_SCOPES.map((example) => example.label),
    ["Kitchen remodel", "Deck repair", "Interior painting"],
  );
});

test("work-type picker offers the Figma rail trades first", () => {
  assert.deepEqual(ONBOARDING_WORK_TYPES.slice(0, 3), ["Remodeling", "Painting", "Flooring"]);
});

test("shouldRedirectToOnboarding fires only for a truly empty, non-skipped org", () => {
  assert.equal(shouldRedirectToOnboarding({ projectCount: 0, estimateCount: 0, skipped: false }), true);
  assert.equal(shouldRedirectToOnboarding({ projectCount: 1, estimateCount: 0, skipped: false }), false);
  assert.equal(shouldRedirectToOnboarding({ projectCount: 0, estimateCount: 1, skipped: false }), false);
  assert.equal(shouldRedirectToOnboarding({ projectCount: 0, estimateCount: 0, skipped: true }), false);
  // Uncountable reads fail open to the dashboard, never to onboarding.
  assert.equal(shouldRedirectToOnboarding({ projectCount: null, estimateCount: 0, skipped: false }), false);
  assert.equal(shouldRedirectToOnboarding({ projectCount: 0, estimateCount: null, skipped: false }), false);
});
