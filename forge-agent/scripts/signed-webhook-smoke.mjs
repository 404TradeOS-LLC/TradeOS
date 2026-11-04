import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";

const root = resolve(import.meta.dirname, "..");
const entrypoint = resolve(root, ".output/server/index.mjs");
const testSecret = "local-only-forge-signature-smoke";
const port = await new Promise((ok, fail) => {
  const server = createServer();
  server.once("error", fail);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => ok(address.port));
  });
});
const base = "http://127.0.0.1:" + port;
const env = { ...process.env, HOST: "127.0.0.1", PORT: String(port) };
for (const name of ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET", "FORGE_GITHUB_WRITE_TOKEN",
  "FORGE_GITHUB_READ_TOKEN"]) delete env[name];
// This is a fake App ID with a local-only test secret. It cannot send
// GitHub messages or access any repository or production resource.
env.GITHUB_APP_ID = "1234";
env.GITHUB_WEBHOOK_SECRET = testSecret;
env.FORGE_WRITE_ENABLED = "false";

const child = spawn(process.execPath, [entrypoint], {
  cwd: root, env, stdio: ["ignore", "ignore", "ignore"],
});
try {
  let healthy = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw Error("Eve server exited before ready");
    try {
      const response = await fetch(base + "/eve/v1/health", {
        signal: AbortSignal.timeout(800),
      });
      if (response.status === 200 && (await response.json()).ok === true) {
        healthy = true;
        break;
      }
    } catch {
      // Server is starting; test has a bounded deadline below.
    }
    await pause(100);
  }
  assert.equal(healthy, true, "Eve health endpoint did not become ready");

  // Ping is a deliberately inert event; a valid signature authenticates it,
  // but it never starts a model run or requires GitHub App credentials.
  const body = JSON.stringify({ zen: "forge test", hook_id: 1234 });
  const validSignature = "sha256=" + createHmac("sha256", testSecret)
    .update(body, "utf8").digest("hex");
  const send = (signature) => fetch(base + "/eve/v1/github", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": "ping",
      "x-github-delivery": "0a314231-a322-4032-9931-120309122001",
      "x-hub-signature-256": signature,
    },
    body,
    signal: AbortSignal.timeout(2000),
  });

  const signed = await send(validSignature);
  assert.equal(signed.status, 200, "Valid GitHub signature must be accepted");
  assert.deepEqual(await signed.json(), { ignored: true, ok: true });

  const invalid = await send("sha256=" + "0".repeat(64));
  assert.equal(invalid.status, 401, "Invalid GitHub signature must be rejected");
  console.log("Eve signed webhook PASS: valid local signature 200; invalid signature 401");
} finally {
  child.kill("SIGTERM");
  if (child.exitCode === null && child.signalCode === null) {
    await Promise.race([
      new Promise((ok) => child.once("exit", ok)),
      pause(2000).then(() => child.kill("SIGKILL")),
    ]);
  }
}
