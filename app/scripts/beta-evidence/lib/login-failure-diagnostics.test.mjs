import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { captureLoginFailureDiagnostics } from "./login-failure-diagnostics.mjs";

// Minimal page stand-in for a login page that rejected the credentials:
// body text carries the inline server error, .server-error holds the same
// message, the screenshot records a path, and the collectors saw one
// console error and one failed request before the timeout.
function fakeFailingLoginPage({ bodyText, serverErrorText }) {
  return {
    url: () => "https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app/login",
    screenshot: async ({ path: screenshotPath }) => {
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      await fs.writeFile(screenshotPath, "fake-png-bytes");
    },
    locator: (selector) => ({
      innerText: async () => {
        if (selector === ".server-error") {
          if (serverErrorText === null) throw new Error("locator.innerText: Timeout 1000ms exceeded");
          return serverErrorText;
        }
        return bodyText;
      },
    }),
  };
}

async function withTempDir(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "login-failure-diag-"));
  try {
    return await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("captures body text, server-error text, console errors, failed requests, and a screenshot", async () => {
  await withTempDir(async (dir) => {
    const page = fakeFailingLoginPage({
      bodyText: "Sign in\nEmail address\nPassword\nInvalid email or password",
      serverErrorText: "Invalid email or password",
    });
    const diagnostics = await captureLoginFailureDiagnostics(page, dir, {
      consoleErrors: ["Failed to load resource: the server responded with a status of 401"],
      failedRequests: ["POST https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app/login"],
    });

    assert.equal(diagnostics.url, "https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app/login");
    assert.match(diagnostics.bodyText, /Invalid email or password/);
    assert.equal(diagnostics.serverErrorText, "Invalid email or password");
    assert.deepEqual(diagnostics.consoleErrors, [
      "Failed to load resource: the server responded with a status of 401",
    ]);
    assert.deepEqual(diagnostics.failedRequests, [
      "POST https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app/login",
    ]);
    assert.ok(diagnostics.screenshotPath.endsWith(path.join("auth", "login-failure.png")));
    assert.ok(diagnostics.bodyTextPath.endsWith(path.join("auth", "login-failure.txt")));
    assert.ok(diagnostics.diagnosticsPath.endsWith(path.join("auth", "login-failure-diagnostics.json")));

    const screenshot = await fs.readFile(path.join(dir, diagnostics.screenshotPath));
    assert.equal(screenshot.toString(), "fake-png-bytes");
    const text = await fs.readFile(path.join(dir, diagnostics.bodyTextPath), "utf8");
    assert.match(text, /Invalid email or password/);
    const stored = JSON.parse(await fs.readFile(path.join(dir, diagnostics.diagnosticsPath), "utf8"));
    assert.equal(stored.serverErrorText, "Invalid email or password");
    assert.equal(stored.consoleErrors.length, 1);
    assert.equal(stored.failedRequests.length, 1);
    // The diagnostics carry no credential material: no password field, and
    // the captured text is page body text (innerText excludes field values).
    assert.equal("password" in stored, false);
    assert.doesNotMatch(text, /s3cret-password-value/);
  });
});

test("records a missing server-error element as null instead of failing", async () => {
  await withTempDir(async (dir) => {
    const page = fakeFailingLoginPage({
      bodyText: "Sign in\nEmail address\nPassword",
      serverErrorText: null,
    });
    const diagnostics = await captureLoginFailureDiagnostics(page, dir);
    assert.equal(diagnostics.serverErrorText, null);
    assert.deepEqual(diagnostics.consoleErrors, []);
    assert.deepEqual(diagnostics.failedRequests, []);
    assert.match(diagnostics.bodyText, /Sign in/);
  });
});

test("is best-effort: a dead page still resolves with null paths", async () => {
  await withTempDir(async (dir) => {
    const deadPage = {
      url: () => "https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app/login",
      screenshot: async () => {
        throw new Error("Target page, context or browser has been closed");
      },
      locator: () => ({
        innerText: async () => {
          throw new Error("Target page, context or browser has been closed");
        },
      }),
    };
    const diagnostics = await captureLoginFailureDiagnostics(deadPage, dir, {
      consoleErrors: ["boom"],
      failedRequests: [],
    });
    assert.equal(diagnostics.screenshotPath, null);
    assert.equal(diagnostics.bodyTextPath, null);
    assert.equal(diagnostics.bodyText, "");
    assert.equal(diagnostics.serverErrorText, null);
    // Collector state survives even when the page itself is gone, and the
    // JSON summary is still written so the failure is diagnosable.
    assert.deepEqual(diagnostics.consoleErrors, ["boom"]);
    assert.ok(diagnostics.diagnosticsPath.endsWith(path.join("auth", "login-failure-diagnostics.json")));
    const stored = JSON.parse(await fs.readFile(path.join(dir, diagnostics.diagnosticsPath), "utf8"));
    assert.deepEqual(stored.consoleErrors, ["boom"]);
  });
});

test("caps body text at 4000 characters", async () => {
  await withTempDir(async (dir) => {
    const page = fakeFailingLoginPage({
      bodyText: "x".repeat(5000),
      serverErrorText: "Invalid email or password",
    });
    const diagnostics = await captureLoginFailureDiagnostics(page, dir);
    assert.equal(diagnostics.bodyText.length, 4000);
  });
});
