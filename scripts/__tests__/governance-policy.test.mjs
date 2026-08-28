import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

test("solo-maintainer policy has an explicit founder exception", () => {
  const adr = read("docs/decisions/ADR-009-solo-maintainer-founder-merge-exception.md");
  const agents = read("AGENTS.md");
  const governance = read("docs/REPOSITORY_GOVERNANCE.md");

  assert.match(adr, /Status: Accepted/);
  assert.match(adr, /founder may explicitly\s+authorize/);
  assert.match(agents, /Solo-maintainer founder merge exception/);
  assert.match(governance, /ADR-009/);
  assert.match(governance, /require_extra_approval_for_unattributed_changes: false/);
});

test("founder exception preserves non-waivable technical gates", () => {
  const adr = read("docs/decisions/ADR-009-solo-maintainer-founder-merge-exception.md");
  const governance = read("docs/REPOSITORY_GOVERNANCE.md");
  const template = read(".github/pull_request_template.md");

  for (const document of [adr, governance, template]) {
    assert.match(document, /required checks/i);
  }
  assert.match(adr, /must not add a broad\s+bypass/i);
  assert.match(governance, /conversation resolution/i);
  assert.match(template, /self-review is not described as independent approval/i);
});
