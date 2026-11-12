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

test("PR maintenance canonicalizes numeric workflow_dispatch input and rejects malformed PR identifiers", async () => {
  const { spawnSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { default: yaml } = await import("js-yaml");
  const workflow = yaml.load(read(".github/workflows/pr-maintenance.yml"));
  const steps = workflow.jobs.rebase.steps;
  const validate = steps.find((step) => step.id === "pr");
  assert.ok(validate?.run, "PR maintenance must have a validation script");
  const normalizedRef = "$" + "{{ steps.pr.outputs.pr_number }}";
  assert.equal(steps.find((step) => step.name === "Rebase pull request branch onto main").env.PR_NUMBER, normalizedRef);
  assert.equal(steps.find((step) => step.name === "Report updated head").env.PR_NUMBER, normalizedRef);

  const directory = fs.mkdtempSync(path.join(tmpdir(), "tradeos-pr-maintenance-"));
  const fakeBin = path.join(directory, "bin");
  fs.mkdirSync(fakeBin);
  fs.writeFileSync(
    path.join(fakeBin, "gh"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "printf '%s\\n' \"$3\" >> \"$GH_CAPTURE\"",
      "if [ \"$3\" != \"961\" ]; then exit 61; fi",
      "case \"$*\" in",
      "  *baseRefName*) printf 'main\\n' ;;",
      "  *headRepository*) printf '404TradeOS-LLC/TradeOS\\n' ;;",
      "  *'--json state'*) printf 'OPEN\\n' ;;",
      "  *) exit 62 ;;",
      "esac",
    ].join("\n") + "\n",
    { mode: 0o755 },
  );
  try {
    for (const [raw, isValid] of [
      ["961.0", true],
      ["961", true],
      ["961.00", true],
      ["961.5", false],
      ["0", false],
      ["-1", false],
      ["961;echo unsafe", false],
    ]) {
      const output = path.join(directory, "output");
      const capture = path.join(directory, "capture");
      fs.writeFileSync(output, "");
      fs.writeFileSync(capture, "");
      const result = spawnSync("bash", ["-e", "-c", validate.run], {
        cwd: directory,
        encoding: "utf8",
        env: {
          ...process.env,
          PR_NUMBER: raw,
          GITHUB_OUTPUT: output,
          GITHUB_REPOSITORY: "404TradeOS-LLC/TradeOS",
          GH_CAPTURE: capture,
          PATH: fakeBin + ":" + process.env.PATH,
        },
      });
      const calls = fs.readFileSync(capture, "utf8").trim().split("\n").filter(Boolean);
      if (isValid) {
        assert.equal(result.status, 0, raw + ": " + result.stderr);
        assert.equal(fs.readFileSync(output, "utf8").trim(), "pr_number=961", raw);
        assert.deepEqual(calls, ["961", "961", "961"], raw);
      } else {
        assert.notEqual(result.status, 0, raw + " must be rejected");
        assert.deepEqual(calls, [], raw + " must be rejected before contacting GitHub");
      }
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
