import test from "node:test";
import assert from "node:assert/strict";
import { validateDraft } from "../lib/policy.js";

const sha = "a".repeat(40);
const valid = () => ({
  issueNumber: 910,
  baseSha: sha,
  files: [{ path: "docs/forge/pilot.md", content: "# Pilot\n" }],
});

test("validates a bounded exact-head draft branch", () => {
  const result = validateDraft(valid());
  assert.equal(result.branch, "forge/issue-910-" + sha.slice(0, 12));
  assert.equal(result.files.length, 1);
  assert.deepEqual(result.files, valid().files);
});

test("cannot accept short SHAs or branch names in place of immutable main", () => {
  for (const baseSha of ["main", "a".repeat(12), "b".repeat(41)]) {
    assert.throws(() => validateDraft({ ...valid(), baseSha }), /main SHA/);
  }
});

test("cannot publish outside docs/forge, traverse or upload binary paths", () => {
  const paths = [
    ".github/workflows/a.yml", "app/prisma/schema.prisma",
    "web/src/components/A.tsx", "docs/forge/../operations/a.md",
    "docs/forge/.secret.md", "docs/forge/test.txt",
    "docs/forge/file\\name.md", "docs/forge/path%2e%2e.md",
  ];
  for (const path of paths) {
    assert.throws(() => validateDraft({ ...valid(), files: [{ path, content: "x" }] }), /docs\/forge/);
  }
});

test("rejects duplicate, empty, oversized and over-count payloads", () => {
  const a = valid().files[0];
  assert.throws(() => validateDraft({ ...valid(), files: [a, a] }), /duplicate/);
  assert.throws(() => validateDraft({ ...valid(), files: [{ ...a, content: "  " }] }), /Empty/);
  assert.throws(() => validateDraft({ ...valid(), files: [{ ...a, content: "X".repeat(50*1024) }] }), /48 KiB/);
  const many = Array.from({ length:5 }, (_,i)=>({path:"docs/forge/f"+i+".md",content:"# F"}));
  assert.throws(() => validateDraft({ ...valid(), files: many }), /count/);
});
