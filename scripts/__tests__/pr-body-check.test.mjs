import assert from "node:assert/strict";
import test from "node:test";

import { REQUIRED_PR_SECTIONS, validatePrBody } from "../pr-body-check.mjs";

function completeBody(summary = "Repairs a bounded runtime defect.") {
  return REQUIRED_PR_SECTIONS.map((title) => {
    if (title === "Summary") return `## ${title}\n\n${summary}`;
    return `## ${title}\n\n- [ ] Example`;
  }).join("\n\n");
}

test("accepts a complete template with a real summary", () => {
  assert.deepEqual(validatePrBody(completeBody()), {
    ok: true,
    missingSections: [],
    summaryMissing: false,
  });
});

test("rejects omitted required sections", () => {
  const body = completeBody().replace("## Risk Review\n\n- [ ] Example\n\n", "");
  const result = validatePrBody(body);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingSections, ["Risk Review"]);
});

test("rejects a template-only summary", () => {
  const result = validatePrBody(completeBody("<!-- describe this PR -->"));
  assert.equal(result.ok, false);
  assert.equal(result.summaryMissing, true);
});

test("rejects required headings that exist only inside HTML comments", () => {
  const hiddenSections = REQUIRED_PR_SECTIONS.filter((title) => title !== "Summary")
    .map((title) => `## ${title}\n\n- [ ] Hidden`)
    .join("\n\n");
  const body = `## Summary\n\nVisible summary\n\n<!--\n${hiddenSections}\n-->`;

  const result = validatePrBody(body);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingSections, REQUIRED_PR_SECTIONS.filter((title) => title !== "Summary"));
});
