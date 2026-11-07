import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";

const root = resolve(import.meta.dirname, "..");
const entrypoint = resolve(root, ".output/server/index.mjs");

async function freePort() {
  const server = createServer();
  await new Promise((ok, fail) => server.once("error", fail).listen(0, "127.0.0.1", ok));
  const address = server.address();
  await new Promise((ok) => server.close(ok));
  return address.port;
}

const port = await freePort();
const base = "http://127.0.0.1:" + port;
const env = { ...process.env, HOST: "127.0.0.1", PORT: String(port), FORGE_WRITE_ENABLED: "false" };
// Never use a real GitHub App or write token during the unauthenticated smoke.
for (const key of ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GITHUB_WEBHOOK_SECRET",
  "FORGE_GITHUB_WRITE_TOKEN", "FORGE_GITHUB_READ_TOKEN"]) delete env[key];

const child = spawn(process.execPath, [entrypoint], {
  cwd: root, env, stdio: ["ignore", "ignore", "ignore"],
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw Error("Eve server exited before health became ready");
    try {
      const health = await fetch(base + "/eve/v1/health", { signal: AbortSignal.timeout(800) });
      if (health.status === 200) {
        const body = await health.json();
        assert.equal(body.ok, true);
        assert.equal(body.status, "ready");
        ready = true;
        break;
      }
    } catch (error) {
      if (error.name === "AssertionError") throw error;
    }
    await pause(100);
  }
  assert.equal(ready, true, "Eve health endpoint never became ready");

  const restricted = [
    ["/eve/v1/info", { method: "GET" }],
    ["/eve/v1/session", { method: "POST" }],
    ["/eve/v1/github", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-github-delivery": "forged-delivery",
      },
      body: JSON.stringify({ action: "opened", issue: { number: 123 } }),
    }],
  ];
  for (const [path, options] of restricted) {
    const response = await fetch(base + path, {
      ...options, signal: AbortSignal.timeout(1500),
    });
    assert.equal(response.status, 401, path + " must fail closed without authentication");
  }
  console.log("Eve smoke PASS: health 200, protected info/session 401, unsigned GitHub webhook 401");
} finally {
  child.kill("SIGTERM");
  if (child.exitCode === null && child.signalCode === null) {
    await Promise.race([
      new Promise((ok) => child.once("exit", ok)),
      pause(2000).then(() => child.kill("SIGKILL")),
    ]);
  }
}
