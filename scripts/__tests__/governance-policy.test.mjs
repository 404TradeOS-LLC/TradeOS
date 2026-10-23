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

test("component-only and runner changes execute the Web browser gate", async () => {
  const { execFileSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { default: yaml } = await import("js-yaml");
  const workflow = yaml.load(read(".github/workflows/verify-repository.yml"));
  const script = workflow.jobs.changes.steps.find((step) => step.id === "scope").run;
  const directory = fs.mkdtempSync(path.join(tmpdir(), "tradeos-scope-"));
  const cwd = path.join(directory, "repo");
  fs.mkdirSync(cwd);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git("init", "-q");
    fs.writeFileSync(path.join(cwd, "seed.txt"), "base\n");
    git("add", ".");
    git("-c", "user.name=Scope Test", "-c", "user.email=scope@example.invalid", "commit", "-qm", "base");
    const base = git("rev-parse", "HEAD");
    git("update-ref", "refs/remotes/origin/scope-base", base);
    for (const [file, expected] of [
      ["tests/components/example.spec.ts", true],
      ["playwright.components.config.ts", true],
      ["package.json", true],
      ["package-lock.json", true],
      [".github/workflows/verify-repository.yml", true],
      ["web/src/example.ts", true],
      ["docs/example.md", false],
      ["app/example.ts", false],
    ]) {
      git("reset", "--hard", base);
      const target = path.join(cwd, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "changed\n");
      git("add", ".");
      git("-c", "user.name=Scope Test", "-c", "user.email=scope@example.invalid", "commit", "-qm", file);
      const output = path.join(directory, "output");
      fs.writeFileSync(output, "");
      execFileSync("bash", ["-c", script], { cwd, env: { ...process.env, EVENT_NAME: "pull_request", BASE_REF: "scope-base", GITHUB_OUTPUT: output } });
      assert.match(fs.readFileSync(output, "utf8"), new RegExp(`web=${expected}\\n`), file);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
