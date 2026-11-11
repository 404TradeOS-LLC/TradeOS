// Login-failure diagnostics for the beta-evidence auth bootstrap.
//
// A bare "login timed out" cannot tell a rejected login from a swallowed
// submit, so on login failure this captures what the page actually showed:
// a screenshot, the visible body text, the inline server-error text
// (`.server-error`, rendered by web/src/components/entry/login-entry.tsx),
// and the console errors / failed requests the caller collected while the
// login attempt ran. Ported from the motion branch's 64fd00ff diagnostic
// commit (screenshot + page text) and extended with the console-error and
// failed-request collectors capture-evidence.mjs already keeps.
//
// Carries no credential material: the email field is masked in the
// screenshot, password inputs render masked, and innerText excludes field
// values, so neither the password nor the filled email address is captured.
// Every capture step is best-effort — a dead page must never mask the login
// error itself.

import fs from "node:fs/promises";
import path from "node:path";

const MAX_BODY_TEXT_CHARS = 4000;
const MAX_COLLECTED_ENTRIES = 50;

export async function captureLoginFailureDiagnostics(
  page,
  evidenceDir,
  { consoleErrors = [], failedRequests = [] } = {},
) {
  const authDir = path.join(evidenceDir, "auth");
  await fs.mkdir(authDir, { recursive: true });

  let url = "";
  try {
    url = page.url();
  } catch {
    // Best effort; the login error below is the signal.
  }

  let screenshotPath = null;
  try {
    const target = path.join(authDir, "login-failure.png");
    // The email field retains the entered address in plain text; mask it
    // so the failure screenshot carries no credential material.
    await page.screenshot({ path: target, mask: [page.locator('[name="email"]')] });
    screenshotPath = path.relative(evidenceDir, target);
  } catch {
    // Best effort; the login error below is the signal.
  }

  let bodyText = "";
  let bodyTextPath = null;
  try {
    bodyText = (await page.locator("body").innerText()).trim().slice(0, MAX_BODY_TEXT_CHARS);
    const target = path.join(authDir, "login-failure.txt");
    await fs.writeFile(target, `url: ${url}\n\n${bodyText}\n`);
    bodyTextPath = path.relative(evidenceDir, target);
  } catch {
    // Best effort; the login error below is the signal.
  }

  let serverErrorText = null;
  try {
    const text = (await page.locator(".server-error").innerText({ timeout: 1000 })).trim();
    serverErrorText = text.length > 0 ? text : null;
  } catch {
    // No inline server error rendered; that absence is itself diagnostic.
  }

  const diagnostics = {
    url,
    bodyText,
    serverErrorText,
    consoleErrors: [...consoleErrors].slice(0, MAX_COLLECTED_ENTRIES),
    failedRequests: [...failedRequests].slice(0, MAX_COLLECTED_ENTRIES),
    screenshotPath,
    bodyTextPath,
    diagnosticsPath: null,
  };

  try {
    const target = path.join(authDir, "login-failure-diagnostics.json");
    await fs.writeFile(target, `${JSON.stringify(diagnostics, null, 2)}\n`);
    diagnostics.diagnosticsPath = path.relative(evidenceDir, target);
  } catch {
    // Best effort; the login error below is the signal.
  }

  return diagnostics;
}
