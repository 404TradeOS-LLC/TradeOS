import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// CodeRabbit findings on PR #1009 (DEV-7): the Textarea template interpolated
// a raw Figma string into a double-quoted JSX attribute, and the README
// required Dev Mode inspection before publication even though snippets only
// appear in Dev Mode after publication. These are source-string contracts:
// the `figma` module is provided by the Code Connect CLI at parse/preview
// time, so the templates cannot be executed in this repo's test runs.
const textarea = fs.readFileSync("design/code-connect/Textarea.figma.ts", "utf8");
const readme = fs.readFileSync("design/code-connect/README.md", "utf8");

test("Textarea placeholder renders through renderProp, never raw interpolation", () => {
  assert.match(
    textarea,
    /figma\.helpers\.react\.renderProp\('placeholder', placeholder\)/,
    "placeholder must render via figma.helpers.react.renderProp so embedded quotes cannot close the JSX attribute early",
  );
  assert.doesNotMatch(
    textarea,
    /placeholder="\$\{placeholder\}"/,
    "a raw placeholder interpolation into a double-quoted attribute produces invalid JSX when the Figma text contains a double quote",
  );
});

test("Textarea template still maps Disabled and Error states", () => {
  assert.match(textarea, /state === 'disabled' \? 'disabled' : ''/);
  assert.match(textarea, /state === 'error' \? 'aria-invalid="true"' : ''/);
});

test("Code Connect verification uses CLI preview before publication, not Dev Mode", () => {
  assert.match(
    readme,
    /npx figma connect preview/,
    "pre-publication snippet inspection must use the supported CLI preview command",
  );
  assert.match(
    readme,
    /post-publication check/,
    "Dev Mode inspection must be documented as a post-publication check: snippets only appear in Dev Mode after publication",
  );
  assert.doesNotMatch(
    readme,
    /inspect the rendered snippets in Figma Dev Mode, check all variant options/,
    "the old workflow required Dev Mode inspection before publication, which Figma's flow does not support",
  );
});
