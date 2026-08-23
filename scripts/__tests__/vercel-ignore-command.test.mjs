import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const repositoryRoot = new URL("../../", import.meta.url);
const vercelConfig = JSON.parse(
  readFileSync(new URL("app/vercel.json", repositoryRoot), "utf8"),
);

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_EMAIL: "deployment-test@tradeos.local",
      GIT_AUTHOR_NAME: "TradeOS deployment test",
      GIT_COMMITTER_EMAIL: "deployment-test@tradeos.local",
      GIT_COMMITTER_NAME: "TradeOS deployment test",
    },
  }).trim();
}

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), "tradeos-vercel-ignore-"));
  git(cwd, "init", "--quiet");
  writeFileSync(join(cwd, "README.md"), "initial\n");
  mkdirSync(join(cwd, "app"));
  writeFileSync(join(cwd, "app", "index.ts"), "export {};\n");
  writeFileSync(
    join(cwd, "app", "vercel-ignore-build.sh"),
    readFileSync(new URL("app/vercel-ignore-build.sh", repositoryRoot), "utf8"),
  );
  git(cwd, "add", ".");
  git(cwd, "commit", "--quiet", "-m", "initial");
  const previousSha = git(cwd, "rev-parse", "HEAD");

  writeFileSync(join(cwd, "README.md"), "docs-only change\n");
  git(cwd, "add", ".");
  git(cwd, "commit", "--quiet", "-m", "docs only");

  return { cwd, previousSha, commitSha: git(cwd, "rev-parse", "HEAD") };
}

function runIgnoredBuildStep(fixtureState, overrides = {}) {
  return spawnSync("sh", ["-c", vercelConfig.ignoreCommand], {
    cwd: join(fixtureState.cwd, "app"),
    env: {
      ...process.env,
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "feature/example",
      VERCEL_GIT_PREVIOUS_SHA: fixtureState.previousSha,
      VERCEL_GIT_COMMIT_SHA: fixtureState.commitSha,
      ...overrides,
    },
  }).status;
}

test("backend ignore command satisfies Vercel's schema length limit", () => {
  assert.ok(Buffer.byteLength(vercelConfig.ignoreCommand, "utf8") <= 256);
});

test("backend previews still skip when backend inputs are unchanged", () => {
  const state = fixture();
  assert.equal(runIgnoredBuildStep(state), 0);
});

test("backend production deploys from main are never skipped as unchanged", () => {
  const state = fixture();
  assert.equal(
    runIgnoredBuildStep(state, {
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "main",
    }),
    1,
  );
});

test("backend previews continue when backend inputs changed", () => {
  const state = fixture();
  writeFileSync(join(state.cwd, "app", "index.ts"), "export const changed = true;\n");
  git(state.cwd, "add", ".");
  git(state.cwd, "commit", "--quiet", "-m", "backend change");
  state.commitSha = git(state.cwd, "rev-parse", "HEAD");

  assert.equal(runIgnoredBuildStep(state), 1);
});

test("missing previous deployment commit fails open to a build", () => {
  const state = fixture();
  assert.equal(
    runIgnoredBuildStep(state, { VERCEL_GIT_PREVIOUS_SHA: "missing" }),
    1,
  );
});
