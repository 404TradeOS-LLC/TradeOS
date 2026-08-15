import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

function loadIgnoreCommand(relativePath) {
  const config = JSON.parse(readFileSync(join(repoRoot, relativePath), "utf8"));
  return config.ignoreCommand;
}

function createRepository() {
  const directory = mkdtempSync(join(tmpdir(), "tradeos-vercel-ignore-"));
  execFileSync("git", ["init", "--quiet"], { cwd: directory });
  execFileSync("git", ["config", "user.email", "tradeos-test@example.com"], { cwd: directory });
  execFileSync("git", ["config", "user.name", "TradeOS Test"], { cwd: directory });
  mkdirSync(join(directory, "app"), { recursive: true });
  mkdirSync(join(directory, "web"), { recursive: true });
  writeFileSync(join(directory, "app", "index.ts"), "export {};\n");
  writeFileSync(join(directory, "web", "page.tsx"), "export default function Page() { return null; }\n");
  execFileSync("git", ["add", "."], { cwd: directory });
  execFileSync("git", ["commit", "--quiet", "-m", "initial"], { cwd: directory });
  const commitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: directory, encoding: "utf8" }).trim();
  return { directory, commitSha };
}

for (const relativePath of ["app/vercel.json", "web/vercel.json"]) {
  test(`${relativePath} builds when Vercel's previous SHA is unavailable`, () => {
    const { directory, commitSha } = createRepository();
    try {
      const result = spawnSync("sh", ["-c", loadIgnoreCommand(relativePath)], {
        cwd: directory,
        encoding: "utf8",
        env: {
          ...process.env,
          VERCEL_GIT_PREVIOUS_SHA: "934bccdf7a575fc502bb2113bb14d8a64ea4169d",
          VERCEL_GIT_COMMIT_SHA: commitSha,
        },
      });

      assert.equal(result.status, 1, `expected build-required exit 1, got ${result.status}`);
      assert.equal(result.stderr, "", `ignore command leaked a fatal git error: ${result.stderr}`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
